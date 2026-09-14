---
title: Vue2 到 Vue3 表格上下移失效：从 $set 到 VXE 回写的一次排障
copyright_type: original
comments: true
date: '2026-08-26 20:00:00'
tags:
- Vue2
- Vue3
- VXE-Table
- 响应式
- 前端踩坑
categories:
- 前端踩坑笔记
abbrlink: d34c62e9
updated: '2026-08-26 20:00:00'
---

最近把一套老 HIS 页面从 Vue2 + VXE3 迁到 Vue3 + VXE4，遇到一个很「迷惑」的问题：**上移 / 下移在旧页能用，迁过去没反应；再回头看旧页，新增或删除一行之后，上下移也会突然失灵，保存刷新后又好了。**

表面像是迁移适配漏了 API，深挖下去其实是两件事叠在一起：

1. Vue2 对数组 mutation 的依赖收集，比很多人记忆中的「无 deep 就不触发」更激进。
2. 页面自己的 `tableData` 和表格内部数据，经常在增删后被悄悄拆成两份。

这篇记录完整推理链，以及 Vue3 / VXE4 下更稳妥的写法。

## 现象对照

| 场景 | 旧页（Vue2.7 + VXE3） | 迁移页（Vue3 + VXE4） |
| --- | --- | --- |
| 刚查询完，点上下移 | 有反应 | 最初无反应（只改了页面数组） |
| 新增 / 删除后再上下移 | **也没反应**，要保存刷新 | 若只 `$set` / 只改页面副本，同样挂 |
| 保存后重新拉表 | 又好了 | 取决于你有没有把顺序写回表格 |

旧页「能用」并不是实现正确，而是**碰巧还共享同一份数组引用**时，Vue2 的响应式帮你把表格刷了。

## 旧页原来怎么写的

业务页大致是这样：

```js
// 查询后：页面 tableData 与 blendPage.dataSource 同一引用
requestAfter(tableData) {
  this.tableData = tableData
  return tableData
}

moveDown({ rowIndex }) {
  const temp = this.tableData[rowIndex]
  const next = rowIndex + 1
  const nextTemp = this.tableData[next]
  this.$set(this.tableData, rowIndex, nextTemp)
  this.$set(this.tableData, next, temp)
  // 没有 setTableData
}
```

表格组件这边会 watch `dataSource`（**没有 `deep: true`**），把值 `filter` 成自己的 `tableData`，再交给 VXE 的 `data`。

于是一个很自然的误判出现了：

> 无 deep 的 watch 只在引用变了才跑；`$set` 只是改下标，引用没变，按理不该触发。那旧页为什么能动？

这个误判，正是这次排障的起点。

## Vue 2.7 源码：为什么无 deep 也会触发

项目用的是 **Vue 2.7.16**。结论可以拆成三步。

### 1. 对数组的 `$set`，本质是 `splice`

```js
// vue.runtime.esm.js — set()
if (isArray(target) && isValidArrayIndex(key)) {
  target.length = Math.max(target.length, key)
  target.splice(key, 1, val) // ← 关键
  return val
}
```

不是静默改下标，而是走被劫持的数组方法。

### 2. `splice` 会通知数组自己的 Dep

```js
// arrayMethods 里的 mutator
ob.dep.notify()
```

谁订过这个数组的 `__ob__.dep`，谁就会 `update`。

### 3. 读属性时，无 deep 也会订上「子对象 / 数组」的 Dep

```js
// defineReactive 的 getter
get: function reactiveGetter() {
  var value = /* ... */
  if (Dep.target) {
    dep.depend()              // 属性本身
    if (childOb) {
      childOb.dep.depend()    // 数组 / 对象自己的 Observer.dep
      if (isArray(value)) {
        dependArray(value)
      }
    }
  }
  return value
}
```

`watch: { dataSource(val) { ... } }` 求值时只要读到这个数组，就会订上数组 mutation。  
`deep: true` 只是再 `traverse` 一遍嵌套字段；**数组 mutation 这条线本来就通。**

再看 `Watcher.run`：

```js
if (value !== this.value || isObject(value) || this.deep) {
  // Object / Array：引用没变也会执行 callback
  this.cb.call(this.vm, value, oldValue)
}
```

所以链路是：

```text
$set(arr, i, x)
  → splice
  → arr.__ob__.dep.notify()
  → dataSource watch 回调
  → this.tableData = val.filter(...)
  → 新数组交给 VXE
  → 画面换序
```

文档里常说的「不 deep 听不到内部变化」，更准确是：

- **对象字段赋值** `obj.a = 1`：非 deep 通常收不到。
- **数组 mutation**（含 `$set(arr, i, v)`）：非 deep 也常能收到。

旧页「只 `$set` 就能动」，靠的是这条 Vue2 特供链，不是业务代码显式刷新了表格。

## 那为什么新增 / 删除后又不行了？

因为业务里还有一个很常见的同步方法：

```js
getTableData() {
  const { tableData } = this.$refs.wgBlendPage.$refs.blendPage.getTableData()
  this.tableData = tableData.map((item, index) => ({
    ...item,
    sortNo: item.commonDiagId ? index : null,
  }))
}
```

新增后会调它，删除后也会 `setTableData` 再 `getTableData`。

`.map({ ...item })` 的后果是：

- 页面 `this.tableData` 变成**新数组、新行对象**
- blend / VXE 仍挂着**原来的 dataSource / 内部数据**
- 之后上下移继续 `$set` 页面这份「私有副本」
- 表格订阅的还是另一份数组 → **画面不动**

保存再查一遍，`requestAfter` 重新把同一引用赋回去，上下移又「好了」。

所以旧页其实一直有隐患：**上下移依赖「页面数组 === 表格数据源」这个偶然条件。** 增删一打断就坏。不是保存有魔法，是引用重新对齐了。

用日志也能验证：

1. `$set` 同步结束后：只有页面数组顺序变了，`vxeTableCom.tableData` / grid 还是旧序。
2. 紧接着 `dataSource` watch 打出来：`incoming` 新序，`currentTableData` 旧序。
3. `nextTick` 后：grid 才跟上来。

共享引用在时，watch 能救你；引用断了，`$set` 只是在改幽灵数组。

## 迁到 Vue3 + VXE4 后，为什么「照抄」会失效

Vue3 的依赖收集和 VXE4 的数据流都更「显式」：

- 页面改自己的 `tableData`，不再自动等价于改 grid。
- VXE 内部有自己的 `fullData`；换序要靠 `loadData` / 封装好的 `setTableData` 写回去。
- 迁移时如果还先 `getTableData().map(...)`，会把行对象再摊一层，和表格内部引用彻底脱钩，更不能指望原地 mutation。

所以迁移页最初「只改页面数组」时上下移没反应，是预期行为；旧页能用，是 Vue2 + 共享引用帮你瞒过去了。

## 推荐写法

原则就三条：

1. **画面真相在 VXE**，不要只改页面 `tableData` 指望表格跟着动。
2. **改序 / 增删后的展示**一律 `setTableData`（或项目封装的等价 API）。
3. **页面 `tableData` 只作业务副本**（保存、校验、`sortNo`），需要时从 `fullData` 同步。

上下移推荐这样写：

```js
moveDown(value) {
  const { row, rowIndex, $rowIndex } = value || {}
  const { fullData } = this.$refs.wgBlendPage.$refs.blendPage.getTableData()
  const data = (fullData || []).slice() // 只换数组壳，尽量保留行对象引用

  let index = this.findTableRowIndex(data, row)
  if (index < 0) index = $rowIndex ?? rowIndex
  if (index == null || index < 0) return
  if (index === data.length - 1) {
    // tip: 已经是最后一行
    return
  }

  const temp = data[index]
  data[index] = data[index + 1]
  data[index + 1] = temp

  this.tableData = data                 // 给保存 / setSortNo
  this.$refs.wgBlendPage.setTableData(data) // 给画面
}
```

上移同理。

注意：带 `.map` 整理 `sortNo` 的 `getTableData()`，更适合**保存前**；不适合当作每次上下移的第一步。上下移先 `map` 一遍，等于主动切断行引用，然后再硬回写，多做了一次无意义的摊平。

## 排障时可以怎么验证

如果你也怀疑「页面动了、表格没动」，不要猜，直接对引用和顺序打点：

```js
const blend = this.$refs.wgBlendPage.$refs.blendPage
const vxe = blend.$refs.vxeTableCom
const grid = vxe.$refs.xEditGrid

console.log({
  pageEqualsDataSource: this.tableData === blend.dataSource,
  pageEqualsVxeTableData: this.tableData === vxe.tableData,
  pageOrder: this.tableData.map(r => r.id),
  gridOrder: grid.getTableData().fullData.map(r => r.id),
})
```

看三件事就够：

1. 引用是否还相等。
2. `$set` / 换序之后，页面顺序有没有先变。
3. 有没有 watch / `setTableData` 把 grid 拉齐。

验证完记得删日志。临时探针很管用，留在业务里只会污染下次排障。

## 小结

| 认知 | 更准确的说法 |
| --- | --- |
| 「无 deep 就听不到数组变化」 | Vue2 读持有数组的属性时，会订数组自身 Dep；mutation 常能触发 |
| 「旧页 `$set` 就能换序，说明写法对」 | 只是共享引用 + Vue2 数组通知在帮你；增删后经常失效 |
| 「迁移后要先 `getTableData` 再换序」 | 应对齐的是 `fullData`；带 `.map` 的整理更适合保存，不适合每次上下移 |
| 「Vue3 表格换序怎么写」 | `fullData.slice()` → 交换 → `setTableData` + 同步页面副本 |

这次最大的收获不是某个 API 叫什么，而是：

> **表格场景里，不要把「页面 data 碰巧能驱动 UI」当成契约；把「读表格真相 → 改完显式回写」写成契约。**

旧框架的隐式同步，迁版本时最容易变成幽灵 bug。能用日志证明引用断点，再用源码钉死触发条件，比反复改 `$set` / `deep` 省事得多。
