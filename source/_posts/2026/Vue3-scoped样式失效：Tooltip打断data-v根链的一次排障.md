---
title: Vue3 scoped 样式失效：Tooltip 打断 data-v 根链的一次排障
copyright_type: original
comments: true
date: '2026-08-27 21:10:00'
tags:
- Vue3
- Scoped CSS
- Element Plus
- Tooltip
- 前端踩坑
categories:
- 前端踩坑笔记
abbrlink: a7f3c1e2
updated: '2026-08-27 21:10:00'
---

迁移一套 HIS 公共图标组件时，遇到一个很「迷惑」的现象：**去掉内部的 `WgTooltip`，根节点 `<i>` 上有调用方的 `data-v-*`；加上之后，根节点还是 `<i>`，但 `data-v-*` 没了，调用方的 scoped 样式全部失效。**

表面像属性丢了，深挖下去其实是 Vue scoped CSS 的「单根作用域继承」被 Element Plus Tooltip 的 Fragment 根打断了。这篇记录完整推理链、Element UI / Plus 的实现差异，以及真正不受 `disabled` 影响的修法。

## 现象

调用方大致是这样：

```vue
<template>
  <wg-icon v-if="iconName" class="order-type-icon f40" :name="iconName" />
</template>

<style scoped>
.order-type-icon.f40 {
  font-size: 40px;
  max-height: 20px;
}
</style>
```

`wgIcon` 门面内部曾把图标包在 tooltip 里：

```vue
<template>
  <WgTooltip :disabled="disabled" :content="content" :placement="placement">
    <WgIcon ...>
      <WgIconGlyph ... />
    </WgIcon>
  </WgTooltip>
</template>
```

DevTools 里对照：

| 结构 | 根 DOM | 调用方 `data-v-*` | scoped 样式 |
| --- | --- | --- | --- |
| 去掉 `WgTooltip` | `<i class="wg-icon order-type-icon">` | 有 | 生效 |
| 加上 `WgTooltip` | 还是同一个 `<i>` | **无** | 失效 |

DOM 形态几乎没变，偏偏作用域属性没了——这正是误判点。

## 机制：`data-v-*` 不是谁「贴」上去的

`wgIcon` 和底层 `WgIcon` 都没有 `<style scoped>`。`<i>` 上的 `data-v-xxx` **不是自己加的**，而来自 Vue 的一条额外规则：

> 子组件的**根节点**会同时带上父组件的 scope id，这样父组件的 scoped 样式才能给子组件根元素设外边距、字号等。

Vue 3 在 patch 元素时走 `setScopeId`：除了打上当前 vnode 自己的 `scopeId`，还会判断「这个 vnode 是否正好等于某个组件实例的 `subTree`」；只要是，就取该组件 vnode 的 `scopeId` 继续往上递归。**一旦某一层的根不是它，递归立刻终止。**

可以把它想成一条「单根链」：

```text
调用方 <wg-icon> vnode（带 data-v-caller）
  → 必须是 wgIcon.subTree 的根
  → 必须是下一层组件.subTree 的根
  → ……
  → 最终落到真实 DOM（这里是 <i>）
```

链上任何一环变成 Fragment / 多根 / 插槽深处的孩子，继承就断。

## 为什么加了 Tooltip，链就断了

去掉 tooltip 时，链是完整的：

```text
orderTypeIcon 的 <wg-icon> vnode
  → wgIcon.subTree 根 = WgIcon
  → WgIcon.subTree 根 = <i>
```

`<i>` 一路继承到 `data-v-caller`，`.order-type-icon { font-size: 40px }` 命中。

加上 `WgTooltip` 后，`wgIcon` 的 `subTree` 根变成了 `WgTooltip`。它只是转发到 `ElTooltip`，再落到 `ElPopper`。而 `ElPopper` 必须同时渲染：

1. trigger（触发器）
2. teleport 出去的 content（浮层）

也就是一个 **Fragment**。`<i>` 是作为 slot 内容塞进 trigger 的，**已经不在「根链」上了**。递归在 Fragment 处停住，调用方的 `data-v-*` 到不了 `<i>`。

### 为什么 DOM 上看不出变化？

Element Plus 的 trigger 走 `ElOnlyChild`：不产生额外包裹元素，只透传并挂事件。所以肉眼看到的根还是 `<i>`，但 vnode 树的「谁是谁的 subTree 根」已经变了。

**scoped 看的是 vnode 身份，不是最终 DOM 标签名。**

## 误区一：`:deep()` 能治吗？

结构上就不可能。`:deep(.order-type-icon)` 编译出来是**后代选择器**：

```css
[data-v-caller] .order-type-icon { ... }
```

它要求存在一个带 `data-v-caller` 的**祖先元素**。而 `orderTypeIcon` 的模板根就是 `<wg-icon>` 本身——组件自己没有渲染任何真实包裹节点，`data-v-caller` 唯一可能落脚的地方就是那个 `<i>`。

于是两头都不成立：

- 加了 tooltip 后，`<i>` 连 id 都拿不到；
- 就算拿到了，`:deep` 是后代组合器，也选不到元素自身。

**`:deep()` 治不了「组件根节点就是子组件」这种情况。** 它只在你自己模板里有真实包裹元素时才有用——比如页面里 `<div class="cell"><wg-order-type-icon /></div>`，再写 `:deep(.order-type-icon)` 才能命中。

`class` / `style` 倒是能正常透传到 `<i>`（经 `$attrs` 转发），所以「类名在、样式挂不上」会显得更诡异。

## 误区二：默认关掉 tooltip 算根治吗？

有人会想：把 `disabled` 默认设为 `true`，大多数调用不渲染浮层，不就好了？

这只是把暴露面从「100% 的调用」缩到「真正开 tip 的调用」。**只要 `disabled: false`，tooltip 仍出现在根链上，链照样断。** 称它「根治」是说过头了。

结构上绕不过去：Element Plus 的 tooltip 一旦出现在根链上，就必须是 Fragment（trigger + content），Vue 3 的 scope id 只沿单根传递，遇到 Fragment 必停。没有「某个 prop 让它变回单根」的配置。

## 这是 Vue2→3 的规则变了，还是 EU→EP 的实现变了？

对照旧 HIS 同一组件：用或不用 tooltip，`.order-type-icon` 的 scoped 样式都生效。

**主因是 Element UI 与 Element Plus 的实现差异，不是 Vue 2/3 的 scoped 规则变了。**

Vue 2 的 `setScope` 同样只沿「渲染根」向上走：`vnode.parent` 只有在该 vnode 是某个组件的渲染根时才有值。语义和 Vue 3 的 `subTree` 判断同构——链断了照样拿不到 id。

差异在 tooltip 本身：

**Element UI**：把 slot 的第一个 vnode **直接当作自己的渲染结果返回**，只往上挂事件和指令。根链天然不断，`<svg>` / `<i>` 能同时拿到组件自己的和调用方的 scope id。

**Element Plus**：必须同时渲染 trigger 与 teleport content，根是 Fragment。行为增强变成了结构改变。

这是 Vue2→Vue3 迁移里一类**隐性破坏面**：旧代码「包一层 tooltip」在 EU 下无感，迁到 EP 后调用方 scoped 样式会静默失效，DevTools 里还几乎看不出 DOM 差了什么。

## 真正不受 `disabled` 影响的修法

目标语义应回到 Element UI 时代：

> tooltip 是行为增强，不应该改变 vnode 结构。

Element Plus 提供了公开 API：`virtual-triggering` + `virtual-ref`。trigger 不渲染任何元素，事件直接 `addEventListener` 到外部 DOM 上。

把 `WgTooltip` 从外层挪进 `WgIcon` 的 slot：

```vue
<script setup>
const inner = ref(null)
const triggerEl = computed(() => inner.value?.$el ?? undefined)
</script>

<template>
  <WgIcon ref="inner" v-bind="forwardedAttrs" @click="onInnerClick">
    <slot>
      <WgIconGlyph :name="name" :height="height" />
    </slot>
    <WgTooltip
      v-if="!disabled"
      virtual-triggering
      :virtual-ref="triggerEl"
      :content="content"
      :placement="placement"
    />
  </WgIcon>
</template>
```

要点：

1. **根永远是 `WgIcon`**，单根链恢复，`disabled` 真假都不断。
2. `v-if="!disabled"` 只是少挂一个空 tooltip 实例，不是作用域修复本身。
3. `virtual-ref` / `virtual-triggering` 必须是 `ElTooltip` 的**声明式 prop**。若中间门面只转发 `props`、不转发 `$attrs`，这两个字段必须出现在 props 声明里，否则会被丢掉。

用 Vite SSR 通道做了真实渲染对照（SSR 与客户端同一套 `subTree` 判断）：

| 场景 | `<i>` 上的 `data-v-caller` |
| --- | --- |
| 对照：根是 `WgIcon` | 有 |
| 对照：根是 `WgTooltip` 包 `WgIcon`（改前坏结构） | 无 |
| 实际组件，`disabled=true` | 有 |
| 实际组件，`disabled=false` | 有 |

对照成功复现了现象，实际组件两种状态都拿到了 id。

再加一条契约测试锁住结构——谁以后把 tooltip 挪回外层，AST 根节点就不是 `WgIcon`，测试立刻红：

```js
test('wgIcon keeps WgIcon as the single root so caller scoped styles still apply', () => {
  const { descriptor } = parse(source, { filename })
  const roots = descriptor.template.ast.children.filter(
    (node) => node.type === 1 || (node.type === 2 && node.content.trim()),
  )
  assert.equal(roots.length, 1)
  assert.equal(roots[0].tag, 'WgIcon')
  assert.match(source, /virtual-triggering/)
})
```

## 不止这一个组件

凡是「模板根就是 tooltip / popover」的封装，调用方写 scoped 定尺寸都会静默失效。迁移库里同类结构还包括 drag 容器、popTable、各类树选择输入等。

排查清单可以记成四句：

1. DevTools 看根 DOM 有没有调用方的 `data-v-*`。
2. 看组件模板根是不是 `el-tooltip` / `el-popover` 一类多出口组件。
3. 不要指望 `:deep()` 救「根就是子组件」的场景。
4. 行为增强优先用 `virtual-triggering`，或自己包一层真实 DOM 当根（会改变布局语义时再慎用）。

## 顺带踩到的相邻坑（同一轮清理）

修完作用域链之后，同一组件上还有两处容易一起误判：

**1. `height` 只设内层 SVG**

Element Plus 给 `.wg-icon` 容器和 `.wg-icon svg` 都写死 `1em`。只给槽内 Iconify 设 `height="32px"`，容器仍是 `1em`，图标会顶出盒子。正确做法是容器与 svg 同时设 `height`，宽度取 `auto`，让 viewBox 比例决定宽。

**2. 老 `autoWidth` 的 `getBBox` 测量**

Vue2 时代用运行时改 `viewBox` / `width` 适配非正方形图标。Iconify 图标自带真实 viewBox，`height + width:auto` 已够用。测量逻辑可以拆掉；若业务页仍在传 `autoWidth`，**保留 prop 声明**，避免它从 `$attrs` 泄漏成 DOM 上的 `autowidth="true"`。

这两条和 `data-v` 无关，但常在同一轮「图标看起来不对」里一起出现，容易把锅扣错地方。

## 一句话结论

Vue 的 scoped 样式依赖「单根 subTree 链」把父 scope id 传到子组件根 DOM；Element Plus 的 Tooltip 根是 Fragment，会打断这条链，而 Element UI 当年是直接返回 slot vnode，所以旧代码无感。修法不是 `:deep()`，也不是默认关掉 tip，而是让 tooltip **离开根链**——`virtual-triggering` + `virtual-ref` 正是为此准备的公开 API。
