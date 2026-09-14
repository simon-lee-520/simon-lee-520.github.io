---
title: Vue3 + Element Plus：ElSelect Maximum recursive updates 的一次排障
copyright_type: original
comments: true
date: '2026-08-31 21:40:00'
tags:
- Vue3
- Element Plus
- ElSelect
- 异步组件
- defineAsyncComponent
- 响应式
- 前端踩坑
- HIS 迁移
categories:
- 前端踩坑笔记
abbrlink: e8a4b2c1
updated: '2026-09-03 12:20:00'
---

> **2026-09-03 修正**：本文初版把根因定在「大码表 × 多实例首屏全挂，把 Vue3 递归护栏顶穿」，解法是页侧懒挂 option。后来在真实浏览器里做逐层对照复现，发现那个结论**不成立**——数量本身不是原因，真正的扳机是**全局把 `wg-option` 注册成了异步组件**。初版的页侧懒挂之所以「看起来修好了」，只是把 option 数压到了护栏阈值以下。下文按新证据重写，初版推断保留在「第一轮结论错在哪」一节。

把一套老 HIS 页面从 **Vue2 + Element UI** 迁到 **Vue3 + Element Plus** 时，大下拉进页就炸：

```text
Maximum recursive updates exceeded in component <ElSelect>
```

表面像是 `wg-select` 门面或 checkbox 写坏了，实际是三件事叠出来的：**EP 的 option 挂载会改父 Select 的响应式状态**、**Vue3 有一条数 update 次数的护栏**，而**把 option 注册成异步组件，会让每个 option 各自触发一次父级更新**。

## 现象

组件调试场里放了四个 500 条 option 的 `wg-select` 示例，表现很有辨识度：

| 场景 | 结果 |
| --- | --- |
| 从别的菜单切进来 | 不报错 |
| **在本页直接刷新** | 报 `Maximum recursive updates`，组件是 `<ElSelect>` |
| 示例① 单选（slot 写法） | 下拉里只剩 **102** 条 |
| 示例②③ 多选（slot 写法） | 下拉**完全没数据** |
| 示例④ `:options` 配置式（无子节点） | **完全正常** |
| 同样写法但只有 30 条 | 不报错 |
| 旁边放一个原生 `el-select` + `el-option` 对照，500 条 | **不报错** |

两个关键信号：

1. **示例④正常**——它走 `:options` 属性，没有 option 子组件。说明问题出在「option 作为子节点」这条路径上。
2. **原生 EP 对照不炸，过了门面就炸**——但门面代码本身后来被证明是无辜的，见下文二分。

还有个数字巧合值得记下：报错后只渲染出 **102** 条，和 Vue 的护栏阈值 **100** 贴得很近。这不是巧合，是本案的关键线索。

## 第一轮结论错在哪

初版的推理链是这样的：

> 首屏多张卡同时挂大码表（约 150 条 × 多实例）→ 每个 option 向父 Select `onOptionCreate` → 同一轮 flush 里 Select 的 update 转了 100 多圈 → 护栏抛错。

于是解法做在业务页：关闭时只挂已选项，展开才挂全量。

```js
// 初版的止血方案：现在可以回退了
pickSelectOptions(list, modelValue, openKey) {
  const source = Array.isArray(list) ? list : []
  if (this.selectOpenKeys[openKey]) return source
  if (modelValue == null || modelValue === '') return []
  // …只返回已选项
}
```

**它确实让报错消失了**，所以当时就收工了。但它骗过我的原因是：懒挂把首屏 option 数从 150 压到了 0～1，自然低于护栏阈值。**症状消失 ≠ 根因找到**。

真正的破绽是那条「切换进来不报错、刷新才报错」。如果根因只是数量，切换和刷新挂的 option 一样多，不该有差别。

## 二分复现

这次没有再靠推理，而是起了一个独立的 dev server，用 Playwright 把每一层拆开单独渲染，逐个跑（每页只放一个用例，避免互相干扰）：

| 组合（500 条，除非注明） | 结果 |
| --- | --- |
| EP select + EP option | 正常 |
| EP select + 全局 `wg-option` | **报错** |
| EP select + 全局 `wg-option`（**150 条**） | **报错** |
| `wg-select` + EP option | 正常 |
| `wg-select` + 全局 `wg-option`（30 条） | 正常 |
| EP select + 手写同构 wrapper（含 inject、onMounted 注册、两层嵌套） | 正常 |
| EP select + wg-ui 原生 `WgOption` | 正常 |
| **EP select + `defineAsyncComponent(原生 ElOption)`** | **报错** |
| **EP select + 直接 `import` 的 HIS `wg-option`** | **正常** |

最后两行是决定性的：

- 把**原生 `ElOption`**（跟业务门面完全无关）包一层 `defineAsyncComponent`，一样炸；
- 把 **HIS `wg-option` 直接 import**、绕开全局注册，500 条完全正常。

门面实现无辜，扳机是**异步注册**。顺带也否掉了「多实例」这个条件——单个 select 挂 150 个异步 option 就已经炸了。

## 根因：异步注册 × 子节点契约 × 递归护栏

### 1. EP 的 option 挂载会改父 Select 的响应式状态

**Element UI（Vue2）**在 `created` 里 `push` 普通数组：

```js
this.select.options.push(this)
this.select.cachedOptions.push(this)
```

**Element Plus** 写的是响应式 `Map`，而且父级还 watch 着它：

```js
const onOptionCreate = (vm) => {
  states.options.set(vm.value, vm)
  states.cachedOptions.set(vm.value, vm)
}

watch(() => states.options.entries(), () => {
  setSelected()
  // ...
}, { flush: 'post' })
```

也就是说，**每挂一个 option，父 Select 就会被重新调度一次更新**。这是「可能出问题」的前提，但只要所有 option 在同一次渲染里一起挂完，父 Select 只需要更新一次，什么事都没有——原生 500 条不炸就是这个道理。

### 2. Vue3 数的是「同一个 job 转了多少圈」

`vue@3.5.x` 里写死：

```js
const RECURSION_LIMIT = 100

function checkRecursiveUpdates(seen, fn) {
  const count = seen.get(fn) || 0
  if (count > RECURSION_LIMIT) {
    // throw: Maximum recursive updates exceeded in component <XXX>
  }
  seen.set(fn, count + 1)
}
```

注意它数的是**同一个 update job 在一轮 flush 里被执行的次数**，不是 option 个数。这是防无限更新的护栏，不是性能打分。所以「option 超过 100 条就炸」这个流传很广的说法是错的——同步挂 2000 个 option 一样没事。

相关 issue：

- [vuejs/core#11712](https://github.com/vuejs/core/issues/11712)
- [element-plus#18166](https://github.com/element-plus/element-plus/issues/18166)
- [element-plus#15323](https://github.com/element-plus/element-plus/issues/15323)

### 3. 异步组件把「一次更新」拆成了「N 次更新」

项目里全局注册组件时图省事，一律走了 `defineAsyncComponent`：

```js
const component = defineAsyncComponent(() => loader().then((m) => m.default || m))
```

关键在于 `defineAsyncComponent` 的 `setup` 是**每实例**的：

```js
setup() {
  const instance = currentInstance
  if (resolvedComp) {
    return () => createInnerComp(resolvedComp, instance)  // 已缓存：当场同步返回
  }
  // 未缓存：每个实例各自持有一个 loaded
  const loaded = ref(false)
  // …promise resolve 后 loaded.value = true，触发本实例的更新
}
```

于是首次加载时：500 个 `wg-option` 首帧全是占位，promise 落地后**每个实例各自把自己的 `loaded` 翻成 true，各自排一个更新 job**，各自挂载，各自调一次 `onOptionCreate` → 各自把父 `ElSelect` 重新推进队列。同一轮 flush 里 ElSelect 的 job 被执行了 100 多次，护栏抛错并中断本次 flush——所以画面停在 **102 条**，多选那两个更是一条都没渲染出来。

### 4. 这也解释了「刷新炸、切换不炸」

`resolvedComp` 是**闭包里共享的缓存**。chunk 已经加载过之后，后续实例的 `setup` 直接命中 `if (resolvedComp)` 分支同步返回，所有 option 在同一次渲染里挂完，父 Select 只更新一次。

所以：

- **硬刷新**（chunk 未加载）→ 逐个解析、逐拍补挂 → 炸；
- **从别的菜单切过来**（chunk 已缓存）→ 一拍挂完 → 不炸。

初版那条「修好后单独打开一个 150 项的下拉也不报错」，同理——那时候组件早就缓存好了。

**一句话概括三者关系**：EP 让父级对子节点敏感，Vue3 提供了护栏，而异步注册把本该一拍完成的挂载摊成了上百拍。

## 真正的修法：子节点契约件必须同步注册

判定标准不是体积，也不是目录，而是：**这个组件是否必须被父组件在同一渲染帧内枚举到**。异步注册破坏的正是这个契约。按这个标准筛，全局异步注册里命中的只有三个：`wgOption`、`wgTableColumn`、`wgTabPane`——分别对应 `ElSelect`、`ElTable`、`ElTabs` 的子节点登记。

改法是在注册入口加一份同步白名单，其余保持异步：

```js
import wgOption from './common-ui/base/option/index.js'
import wgTableColumn from './common-ui/base/table-column/index.js'
import wgTabPane from './common-ui/base/tab-pane/index.js'
// …其余高频原子件

const SYNC_COMPONENTS = {
  './common-ui/base/option/index.js': wgOption,
  './common-ui/base/table-column/index.js': wgTableColumn,
  './common-ui/base/tab-pane/index.js': wgTabPane,
  // …
}

function getComponent(componentPath) {
  if (!componentPath) return undefined
  if (SYNC_COMPONENTS[componentPath]) return SYNC_COMPONENTS[componentPath]
  if (asyncComponentsByPath.has(componentPath)) return asyncComponentsByPath.get(componentPath)

  const loader = ATHENA_COMPONENT_LOADERS[componentPath]
  if (!loader) return undefined
  const component = defineAsyncComponent(() => loader().then((m) => m.default || m))
  asyncComponentsByPath.set(componentPath, component)
  return component
}
```

### 别按目录一刀切

一开始想过「基础件目录整体同步、业务目录保持异步」，量了下体积就否掉了：

| base 目录下最大的几个 | 体积 |
| --- | --- |
| `icon/` | 3.2 MB |
| `date-picker/` | 196 KB |
| `table/` | 164 KB |

`icon` 一个就 3.2 MB（图标集数据打进了源码），恰恰是最该保持异步的；而它不被任何父组件枚举，异步完全无害。反过来，真正必须同步的 `table-column` 只有 4 KB。**「基础件 = 轻」这个假设在真实仓库里往往不成立，按体积或目录切都会切歪。**

还有个容易踩反的细节：**父组件异步、子组件同步是安全的**（整棵子树晚一拍原子挂载），反过来才出问题。所以 164 KB 的 `wgTable` 可以留异步，只把 4 KB 的 `wgTableColumn` 拎出来同步。

### 补一条 guard 测试

这类问题回归起来毫无征兆，值得钉死：

- 三个子节点契约件必须在白名单里；
- `icon` / `table` 必须留在异步侧；
- 白名单每一项都要有对应的静态 import；
- 白名单的优先级必须高于 `defineAsyncComponent`。

## 验证

| | 递归错误 | 四个示例的 option 数 |
| --- | --- | --- |
| 改前 | 有 | 102 / 0 / 0 / 500 |
| 改后 | **无** | **500 × 4** |

运行时再确认一遍注册形态：`wgOption`、`wgSelect`、`wgTableColumn`、`wgTabPane` 已是同步组件，`wgIcon`、`wgTable`、`wgEditor` 仍是 `AsyncComponentWrapper`。代码分割该保留的都保留了。

（说明：这次重新验证跑在调试场的 500 条用例上；初版那个会诊配置页没有再回归，但机制一致，页侧懒挂那套可以回退了。）

## 调试小记

- **逐层对照比读源码快**。这次读了半天 EP 的 `options.mjs`、`useOption.mjs`，推了好几个假设都不对；真正定位靠的是起一个独立端口的 dev server，用 Playwright 把「EP select + EP option / EP select + 门面 option / 门面 select + EP option / …」九种组合各跑一遍，两轮就锁死了。写对照用例的成本远低于盯着响应式源码空想。
- **注意组件库改过 Element Plus 的 class 命名空间**。这个项目里 wg-ui 把命名空间设成了 `wg`，页面上根本没有 `.el-select`，连原生 EP 组件也渲染成 `.wg-select`。我第一版探针全用 `.el-*` 选择器，结果每个用例都返回「点不开」，差点误判。写选择器或样式覆盖前先去 DevTools 确认真实类名。

## 迁移惯例（修订版）

| 场景 | 做法 |
| --- | --- |
| 全局注册组件库 | 子节点契约件（option / table-column / tab-pane 等）**必须同步注册** |
| 体积大的叶子件（图标集、编辑器） | 保持异步，它们不被父组件枚举 |
| 判定某个组件能不能异步 | 只问一句：父组件需不需要在同一帧里数清它？ |
| 大码表下拉 | 同步注册后不需要页侧懒挂；上千条再考虑 SelectV2 / 远程搜索 |

再遇到同类报错时的最短路径：

1. 先分「刷新炸 / 切换不炸」——只要有这个差别，八成和异步加载时序有关，不是数量问题
2. 拿原生组件做对照，确认是不是自家封装引入的
3. 把封装层拆开逐个跑，别靠读源码猜
4. 找到扳机后，问清楚「谁必须在同一帧里被数到」

## 一句话

> 护栏数的是**同一个 update job 在一轮 flush 里转了多少圈**，不是 option 有多少个。把 option 注册成异步组件，等于让每个 option 各自触发一次父 Select 更新——一百个就顶穿了。**数量只是放大器，异步注册才是扳机。**
