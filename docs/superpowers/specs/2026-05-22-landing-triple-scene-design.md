# 主页三幕滚动背景 — 设计规格

**状态**：已通过（2026-05-22）  
**日期**：2026-05-22  
**范围**：`layout: landing` 个人主页（`/`）  
**技术路线**：方案 2 — 单 WebGL 画布 + 模块化 ScrollDirector

---

## 1. 目标与约束

### 1.1 产品目标

在单页长滚动中，用 **同一 Three.js 画布** 呈现三段沉浸式背景，并与前景 DOM 同步下移：

| 段 | 高度 | 约占总行程 | 背景 | 前景 |
|----|------|------------|------|------|
| 幕 1 | **200vh** | 0% – 39.2% | 宇宙星空 + 原创御剑剑客 | 首屏 Welcome / 头像 / CTA |
| 幕 2 | **160vh** | 39.2% – 70.6% | 赛博朋克夜城（楼、桥、车、人） | 占位段（无正文块） |
| 幕 3 | **150vh** | 70.6% – 100% | 海底世界 | 「关于我」叠在海底上 |

**总滚动高度 `510vh`**（200 + 160 + 150）。段间 **交融过渡固定总高 20vh**（边界 ±10vh，见 §2.3）。

### 1.2 已确认决策

- **资源策略 D**：远景/城市偏程序化与实例化；剑客写实 glTF；技能以粒子/光效/轨迹为主。
- **剑客**：真人比例、原创形象（洒脱出世），**不得**使用商业游戏角色模型或贴图。
- **技能意象**（玩法参考 DNF 狂战士/剑魂，**视觉与命名仅作灵感**，实现为原创特效，避免复刻 DNF 资产）：
  1. **拔刀斩** — 极速拔剑、横向刀光一闪、短暂残影
  2. **崩山击** — 跃起或前踏后下劈，地面冲击波环、碎石粒子
  3. **极·鬼剑术（暴风式）** — 剑客居中短时多段剑气旋风、环形斩击波、剑光残像
- **剑客点击**：任意滚动位置，射线命中剑客即触发；随机待机小动作 + 上述三技能之一；冷却约 1.2s。
- **转场**：剑客在星空→城市混合后期 **飞出画面/化为光点**，不再出现在城/海底。
- **城市密度**：中等（可辨认桥/车/人，非满屏拥挤）。
- **海底交互**：仅幕 3 有效 — 隐藏系统指针、点状光源跟随鼠标；主水母跟随指针投影位置。
- **主页主题**：**锁定暗色**；移除主页主题切换按钮；亮/暗切换仅在博客内页。
- **移动端 M1**：≤768px 不加载 WebGL；三幕各一张 WebP 静帧；无剑客/水母/技能交互。
- **降级**：WebGL 初始化失败时复用 M1 静态三幕。

### 1.3 非目标

- 不在主页实现浅色背景变体。
- 移动端不做三幕动画与点击交互。
- 不引入 React Three Fiber 或整站 React 构建。
- 不使用 DNF/其他商业 IP 的角色模型、图标、音效素材。

---

## 2. 页面结构（DOM / CSS）

### 2.1 `landing.pug` 结构

```text
body.page-landing(data-theme 进入时强制 dark)
  canvas#bg-tech-canvas (fixed, fullscreen, z-index: -1)
  #landing (min-height: 510vh)
    #landing-foreground
      section.act-1.landing-hero (min-height: 200vh)
        — 头像、标题、副标题、CTA、向下滚动提示
        — 移除 #landing-theme-toggle
      section.act-2.act-spacer (min-height: 160vh)
        — 可选：极简引导文案或纯占位
      section.act-3.landing-content (min-height: 150vh)
        .landing-content-inner
          — Markdown「关于我」
    footer.landing-footer
```

### 2.2 指针事件分层

- `#landing-foreground` 默认 `pointer-events: none`。
- 可交互元素（链接、按钮）`pointer-events: auto`。
- `canvas` 全屏在下；空白区域点击穿透到 canvas（触发剑客 raycast）。
- 幕 3 时 `body` 增加 class `act-ocean`：`cursor: none`（仅桌面且 `blend23` 完成度 > 阈值）。

### 2.3 滚动高度与边界

**常量（`constants.js`）**

```js
export const ACT_VH = [200, 160, 150]       // 各幕前景段高度
export const TOTAL_VH = 510                  // 200 + 160 + 150
export const BOUNDARY_12 = 200 / TOTAL_VH   // ≈ 0.3922
export const BOUNDARY_23 = 360 / TOTAL_VH   // ≈ 0.7059
export const BLEND_VH = 20                     // 转场交融总高度（vh）
export const BLEND_HALF_VH = BLEND_VH / 2     // 10vh，边界上下各半
export const BLEND_HALF = BLEND_HALF_VH / TOTAL_VH  // ≈ 0.0196（相对 progress）
```

**CSS**

- `#landing { min-height: 510vh }`
- `.act-1 { min-height: 200vh }`、`.act-2 { min-height: 160vh }`、`.act-3 { min-height: 150vh }`

**ScrollDirector**

- `progress = scrollY / maxScroll`，clamp `[0, 1]`
- **转场交融固定 20vh**（边界 ±10vh，中心对齐幕分界）：
  - 混合区 1：**190vh – 210vh** → `blend12`（0=幕1，1=幕2），progress **`[0.404, 0.447]`**
  - 混合区 2：**350vh – 370vh** → `blend23`（0=幕2，1=幕3），progress 约 **`[0.686, 0.726]`**（随视口高度略变）
- `blend12` / `blend23` 在混合区内用 smoothstep 插值；区外 clamp 为 0 或 1

**设计意图**：幕 1 加长（200vh）给御剑从「朝外飞出」到「水平飞行」更充足的相机行程；幕 3 为 **150vh**，海底与「关于我」有更长的可读与交互行程。

### 2.4 主题

- 进入 landing：`document.documentElement.setAttribute('data-theme', 'dark')`（可不写 localStorage，避免覆盖用户博客偏好；离开 landing 恢复 butterfly 原逻辑）。
- `landing.css`：仅暗色变量；删除或覆盖 `[data-theme='light']` 下 landing 相关规则。

---

## 3. 运行时架构（方案 2）

### 3.1 模块划分

```text
source/js/landing-bg/
  index.js                 # init / dispose / quality gate
  scroll-director.js       # progress, blend12, blend23, camera keyframes
  scenes/space.js          # SceneSpace
  scenes/city.js           # SceneCity
  scenes/ocean.js          # SceneOcean
  character/swordsman.js   # 加载 glTF、动画状态机、飞出转场
  character/skills.js        # 拔刀斩 / 崩山击 / 极·鬼剑术（暴风式）
  interaction/pointer.js   # raycast 剑客、幕3 光点、水母目标
  post/composer.js         # 可选 Bloom（桌面 High）
  constants.js             # ACT_VH、BOUNDARY_12/23、BLEND_VH(20)、颜色 palette
```

入口：`source/js/bg-tech.js` 薄包装 re-export，或 `landing.pug` 直接引用 `landing-bg/index.js`。

### 3.2 ScrollDirector 输出

每帧根据 `progress` 计算：

| 输出 | 说明 |
|------|------|
| `progress` | 全局 0–1 |
| `blend12` | 0=纯星空，1=纯城市（在混合区内平滑） |
| `blend23` | 0=纯城市，1=纯海底 |
| `cameraPose` | 位置 + lookAt + FOV（样条插值） |
| `actIndex` | 1 / 2 / 3（主幕，用于 UI class） |
| `oceanInteractive` | `blend23 > 0.85` 且桌面 |

### 3.3 场景混合策略

三幕各一个 `THREE.Group`，常驻场景，**不**在转场时 dispose 重建。

- 子节点 `opacity` / `visible` / 雾贡献由 `blend12`、`blend23` 驱动。
- 全局 `FogExp2` 颜色在幕间 lerp。
- 可选全屏 `transitionPlane` shader：幕 2→3 时模拟「下沉」水深 overlay。

### 3.4 相机路径（关键帧）

| progress | 机位意图 |
|----------|----------|
| 0.00 | 略高后方，剑客向画外（屏幕外方向）飞去 |
| 0.32 | 接近水平侧跟（幕 1 末段，进入 blend12 前） |
| 0.43 | 衔接城市：低空掠过天际线（blend12 中心附近） |
| 0.55 | 城市中轴平视，可见桥与车流 |
| 0.72 | 城市末段略俯（blend23 前） |
| 0.78 | 入水：俯角加大，青蓝雾浓（blend23 中心附近） |
| 1.00 | 海底平视，鱼群与水母景深 |

关键帧按 `BOUNDARY_12 ≈ 0.392`、`BOUNDARY_23 ≈ 0.706` 对齐，实现阶段在 `scroll-director.js` 微调。

---

## 4. 分幕规格

### 4.1 幕 1 — SceneSpace

**元素**

- 星野：`Points` 多层视差 或 shader 星空球壳。
- 星云/远处光晕：低面片 + additive。
- 流星：偶发粒子轨迹（`prefers-reduced-motion` 关闭）。
- 剑客 + 飞剑：glTF，默认御剑前飞动画循环。

**剑客转场**

- 当 `blend12 > 0.5`：剑客加速向画外上方飞出或 dissolver 为光点；`blend12 > 0.85` 时 `visible = false`。
- 飞出后不再参与 raycast。

### 4.2 幕 2 — SceneCity

**元素（中等密度）**

- 远景：实例化楼宇块 + 霓虹条（CanvasTexture 假文案）。
- 立交桥：模块化重复 mesh。
- 车流：3–5 条 CatmullRom 路径，简模 box + 尾灯 emissive。
- 行人：2–3 条路径，capsule/billboard 慢速。
- 地面：Grid 弱化 + 湿润反射（Reflector 或 fake）。
- 天空：夜空渐变 + 少量全息屏。

**动态（少量）**

- 车灯闪烁、广告牌扫光、雾密度 sin 波动。

### 4.3 幕 3 — SceneOcean

**元素**

- 水体雾：青蓝 `FogExp2`，深度越深越暗。
- 鱼群：`InstancedMesh` 2–3 种路径循环。
- 水母：2–3 只自主漂浮；**主水母** lerp 跟随 `interaction.pointer` 投影到水平面（y 固定）。
- 焦散/气泡：可选简化粒子。

**交互（仅 `oceanInteractive`）**

- `cursor: none` + canvas 内点光源/粒子簇跟随鼠标。
- 剑客不可见；raycast 关闭或仅幕 1 残留组已隐藏。

**前景「关于我」**

- `.landing-content-inner`：磨砂 + 高对比；进入幕 3 后可 0.9→1 opacity 淡入。

---

## 5. 剑客与技能

### 5.1 角色资产

- 格式：glTF/GLB，Draco 压缩，目标体积 < 3MB（可分级 LOD）。
- 外观指导：成年男性、修长、长发或束发、宽袖/长袍、表情淡然；飞剑独立骨骼。
- 风格：写实人体 + **赛博霓虹** 剑光 rim（与站点科技风统一）。
- 来源：自制 Blender 或 CC0 基础人形改模，贴图原创。

### 5.2 动画状态机

| 状态 | 说明 |
|------|------|
| `fly` | 默认御剑前飞 |
| `idle_fidget` | 点击时随机短待机（可选） |
| `skill_draw` | 拔刀斩 |
| `skill_smash` | 崩山击 |
| `skill_storm` | 极·鬼剑术（暴风式） |
| `exit` | 转场飞出 |

无骨骼时：根节点 tween + 剑 mesh 独立旋转。

### 5.3 技能规格（原创 VFX）

| 技能 | 参考手感 | 视觉实现要点 | 时长约 |
|------|----------|--------------|--------|
| 拔刀斩 | 瞬发直线斩 | 剑鞘/拔剑姿态 tween；一道 additive 刀光平面扫过；剑气残像 0.3s | 0.6s |
| 崩山击 | 跳起下砸 | 短时上移后快速下压；地面 RingGeometry 冲击波扩散；碎石 Points 下落 | 0.9s |
| 极·鬼剑术（暴风式） | 多段旋风斩 | 剑客居中锁定；8–12 道弧线刀光绕 Y 轴旋转；中心 glow 脉冲；结束冲击波 | 1.8s |

**点击逻辑**

1. `Raycaster` 命中剑客组（含剑）。
2. 若 `skills.isBusy` 或冷却中 → 忽略。
3. 随机 `skill_*` 之一；播放对应动画 + VFX。
4. 技能结束回到 `fly`（若仍在幕 1 且未飞出）。

---

## 6. 移动端 M1

| 项 | 行为 |
|----|------|
| 断点 | `max-width: 768px` |
| JS | `shouldSkip() === true`，不加载 `landing-bg` |
| CSS | `#landing` 仍 `510vh`；`act-1/2/3` 分别 `200/160/150vh` + 各 `background-image` |
| 素材路径 | `source/img/landing/mobile/act{1,2,3}.webp` |
| 生成方式 | 桌面场景稳定后截图或设计导出 |
| 交互 | 无；系统默认光标 |

WebGL 失败：注入 class `landing-fallback-static`，应用与 M1 相同 CSS。

---

## 7. 性能与无障碍

### 7.1 质量档位（桌面）

| 档位 | 条件 | 策略 |
|------|------|------|
| High | 默认桌面 | Bloom、满粒子、Reflector |
| Mid | `deviceMemory <= 4` 或用户 agent 平板 | 无 Bloom、减实例数 |
| Low | 帧率 < 20fps 持续 3s | 关车流/鱼 instancing 减半 |

### 7.2 `prefers-reduced-motion: reduce`

- 停相机自动路径动画（仅保留 scroll 驱动 progress）。
- 关流星、车流、鱼路径动画、技能非必要 tween。
- 保留 scroll 驱动的场景切换（静态混合）。

---

## 8. 文件变更清单

| 文件 | 操作 |
|------|------|
| `themes/butterfly/layout/landing.pug` | 三段结构、移除主题钮 |
| `source/css/landing.css` | 510vh、act 200/160/150vh、ocean cursor、移动背景 |
| `source/css/custom.css` | 调整 `#bg-tech-canvas`、移除 landing light 扫描线依赖（可选） |
| `source/js/bg-tech.js` | 替换为模块入口或删除逻辑迁到 `landing-bg/` |
| `source/js/landing-bg/**` | 新增 |
| `source/img/landing/mobile/*.webp` | 新增（实现阶段生成） |
| `docs/superpowers/specs/2026-05-22-landing-triple-scene-design.md` | 本文档 |

**废弃**：现有单幕赛博 `bg-tech.js` 城市场景逻辑由 `SceneCity` 替代，不再维护旧单场景。

---

## 9. 验收标准

1. 桌面：单 canvas 连续滚动，0→200vh 星空御剑，200→360vh 城市，360→510vh 海底 + 关于我；边界处 **20vh** 交融无硬切。
2. 转场 **20vh** 混合区内无硬切黑屏；雾色与透明度连续变化。
3. 剑客在第一个混合区后半段（`blend12 > 0.5`）飞出，之后不可见。
4. 点击剑客（幕 1 可见时）随机播放三种技能 VFX 之一，1.2s 内不重复触发。
5. 幕 3：系统指针隐藏，光点跟随；主水母跟随鼠标；幕 1/2 恢复默认指针。
6. 移动：三幕静帧，滚动行程与桌面一致，关于我在第三段清晰可读。
7. 主页无主题切换按钮；始终暗色氛围。
8. `prefers-reduced-motion` 下无自动循环动画（scroll 切换保留）。

---

## 10. 实现顺序建议（供 writing-plans 使用）

1. ScrollDirector + 空三 Group + 相机 keyframes + progress 驱动 opacity（灰盒）。
2. SceneSpace 灰盒 + 剑客占位体 + 点击日志。
3. SceneCity 中等密度 + 转场 blend12。
4. SceneOcean + 幕 3 指针/水母 + 关于我样式。
5. 剑客 glTF 替换占位 + 三技能 VFX。
6. Post Bloom + 性能档位 + M1 静帧与 fallback。
7. 移除旧 `bg-tech` 死代码、验收清单走查。

---

## 11. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 写实 glTF 体积大/加载慢 | Draco + 加载屏已存在；首屏可先低模占位 |
| 三幕同 canvas draw call 高 | 实例化；幕外 Group `visible=false` |
| DNF 技能名引发 IP 误解 | 文案注明「灵感来源」；特效视觉原创 |
| 前景挡住射线 | 分层 pointer-events（§2.2） |
| 移动静帧与桌面差异大 | 桌面稳定后同构图截图 |

---

*审阅通过后，使用 writing-plans 技能生成实现计划。不得在未批准 spec 前开始编码。*
