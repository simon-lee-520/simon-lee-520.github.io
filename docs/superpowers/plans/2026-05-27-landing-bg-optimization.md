# Landing 三幕背景动画 — 整体优化开发计划

**状态**：执行中  
**日期**：2026-05-27  
**关联规格**：[2026-05-22-landing-triple-scene-design.md](../specs/2026-05-22-landing-triple-scene-design.md)  
**代码入口**：`source/js/bg-tech.js` → `source/js/landing-bg/index.js`

---

## 1. 背景与对标结论

### 1.1 我们在做什么

单页 `themes/butterfly/layout/landing.pug` + 固定 WebGL 画布，滚动 510vh 呈现三幕：

| 幕 | DOM | 实现 | 高度 |
|----|-----|------|------|
| 1 宇宙 | `#landing-hero` | VRM 剑客 + 星空 shader | 200vh |
| 2 城市 | `#landing-act-2` | Canvas2D 远景贴图 | 160vh |
| 3 海底 | `#landing-content` | 实例化鱼群 + 水母 + 指针光 | 150vh |

滚动与相机：`source/js/landing-bg/scroll-director.js`

### 1.2 对标参考站点（采纳手法，不移植引擎）

| 采纳 | 不采纳 |
|------|--------|
| DOM 区块 Visual + needsRender 视口裁剪 | three.r112 + 657KB Webpack 单文件引擎 |
| 滚动驱动相机 / 配色 / 后处理分级 | 他的 female.glb 潜水单幕叙事 |
| 弹性鼠标、段边缘 mask、选择性 bloom | 海底改为纯点云（与 spec 冲突） |
| 角色线框 / 散射光 / 动画+VFX 同步思路 | React Three Fiber 重构 |

### 1.3 已完成的基线（Phase 0）

- `engine/visual.js` / `engine/act-visual.js` — 三幕 DOM 绑定
- 城市/海底懒挂载
- shouldTick / shouldDraw 裁剪
- post/composer.js — 宇宙段关闭 bloom、按需 shadow

---

## 2. 总体目标与原则

### 2.1 目标（可验收）

1. **性能**：桌面端三幕滚动 median FPS ≥ 50（1080p）；离屏无无效 update。
2. **电影感**：转场有色调/雾/曝光变化；霓虹与剑光有核心而非全屏糊光。
3. **角色**：飞行与三技能有预备–出手–收招节奏；特效与肢体同步；剑绑手骨（动画资产就绪后）。
4. **合规**：原创人设、无商业 IP；移动端 WebP 静帧降级。

### 2.2 技术原则

- 单 Canvas + ScrollDirector + 三幕 group 混合。
- 资产策略 D：城市/海底程序化；剑客 VRM + 动画片段。
- 新能力放入 `landing-bg/` 子模块。

---

## 3. 分阶段开发计划

见各 Phase 实现状态（代码仓库内对应提交）。

| Phase | 内容 | 状态 |
|-------|------|------|
| 0 | Visual 引擎、懒加载、bloom 按幕 | 已完成 |
| 1 | motion、post 调色/mask/dither、DPR | 代码实现 |
| 2 | animator、skills 同步、星空 shader | 代码实现 |
| 3 | city 预烘焙 fade、滚动联动 | 代码实现 |
| 4 | ocean 深度、elastic、caustics | 代码实现 |
| 5 | DOM reveal、reduced-motion | 代码实现 |

---

## 4. 资产清单

| 资产 | 必须？ | 说明 |
|------|--------|------|
| swordsman.vrm（定制） | 美术后续 | 代码已支持 clips，无 clip 时回退 FLY_POSE |
| 动画 clips | 美术后续 | idle_fly, skill_draw, skill_smash, skill_storm |
| 飞剑 mesh | 美术后续 | 可绑 rightHand，否则方块剑 fallback |
| 城市/鱼/水母 | 否 | 程序化 |

---

## 5. 测试与里程碑

- `pnpm run test:scroll-director`
- `pnpm run test:animator`（新增）
- 手动：全 scroll 录屏、三技能、海底指针、768px 静帧

---

## 6. 风险与范围外

见原计划 §6；不移植旧版 r112 引擎、不引入 R3F。

---

## 附录 A：Blender / VRM 动画导出检查表

- [ ] 骨骼为 VRM Humanoid 命名（或导出时映射）
- [ ] 帧率 30fps，关键帧使用 Bezier / ease，避免线性僵硬
- [ ] `idle_fly` 首尾可循环（首尾 pose 接近）
- [ ] 技能根运动在骨骼/hips 上，少挪 Three.js Group
- [ ] 片段命名：`idle_fly`、`skill_draw`、`skill_smash`、`skill_storm`
- [ ] 导出 VRM 或 glTF 后确认 `gltf.animations.length > 0`
- [ ] 文件覆盖 `source/models/landing/swordsman.vrm` 后执行 `pnpm run models:swordsman`（若改 URL）
- [ ] 在浏览器控制台确认 `[landing-bg] animator clips:` 日志含上述名称

---

## 附录 B：Phase 0 已完成项（changelog）

| 项 | 文件 |
|----|------|
| ViewportVisual / ActVisual | `engine/visual.js`, `engine/act-visual.js` |
| 场景透明度混合 | `engine/scene-blend.js` |
| 三幕 DOM id | `landing.pug` `#landing-act-2` |
| 懒加载 city/ocean | `index.js` |
| 按幕 bloom / shadow | `post/composer.js`, `index.js` |

---

## 附录 C：文件改动索引（按 Phase）

### Phase 1

- `source/js/landing-bg/engine/motion.js`（新建）
- `source/js/landing-bg/post/composer.js`
- `source/js/landing-bg/post/section-mask.js`（新建）
- `source/js/landing-bg/index.js`

### Phase 2

- `source/js/landing-bg/character/animator.js`（新建）
- `source/js/landing-bg/character/swordsman.js`
- `source/js/landing-bg/character/skills.js`
- `source/js/landing-bg/scenes/space.js`
- `tools/test-animator.mjs`（新建）
- `package.json`（test:animator 脚本）

### Phase 3

- `source/js/landing-bg/scenes/city.js`

### Phase 4

- `source/js/landing-bg/materials/fish-lit.js`
- `source/js/landing-bg/scenes/ocean.js`
- `source/js/landing-bg/scenes/enclosure.js`
- `source/js/landing-bg/interaction/pointer.js`

### Phase 5

- `source/css/landing.css`
- `source/js/landing-bg/index.js`（scroll skew、reduced motion）
- `source/js/landing-bg/landing-dom.js`（新建，hero reveal）
