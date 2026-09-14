# 主页三幕滚动背景 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 landing 页用单 WebGL canvas 实现 470vh 三幕滚动背景（星空御剑 → 赛博夜城 → 海底），DOM 前景同步滚动，桌面可点击剑客释放三技能，移动 M1 静帧降级。

**Architecture:** `landing-bg/` 模块化：`ScrollDirector` 将 `scrollY` 映射为 `progress/blend12/blend23/cameraPose`；三幕各一个常驻 `THREE.Group`，转场靠 opacity 与雾色 lerp（20vh 交融带）；剑客/技能/指针交互独立模块；`bg-tech.js` 仅作薄入口。

**Tech Stack:** Hexo 7 + Butterfly theme、Three.js 0.172（CDN ES module）、原生 JS modules、Pug、CSS；无 React/R3F。

**Spec:** [`docs/superpowers/specs/2026-05-22-landing-triple-scene-design.md`](../specs/2026-05-22-landing-triple-scene-design.md)

---

## 文件结构（实现前锁定）

| 文件 | 职责 |
|------|------|
| `source/js/landing-bg/constants.js` | ACT_VH、BOUNDARY、BLEND、PALETTE |
| `source/js/landing-bg/scroll-director.js` | 纯函数 `computeScrollState` + 相机样条 |
| `source/js/landing-bg/scenes/space.js` | 星空、星云、剑客挂载点 |
| `source/js/landing-bg/scenes/city.js` | 楼宇、桥、车、人 |
| `source/js/landing-bg/scenes/ocean.js` | 鱼、水母、水体雾 |
| `source/js/landing-bg/character/swordsman.js` | glTF/占位体、状态机、飞出 |
| `source/js/landing-bg/character/skills.js` | 拔刀斩 / 崩山击 / 极·鬼剑术 |
| `source/js/landing-bg/interaction/pointer.js` | raycast、幕3 光点、body class |
| `source/js/landing-bg/post/composer.js` | Bloom（High 档） |
| `source/js/landing-bg/index.js` | init / animate / dispose / quality |
| `source/js/bg-tech.js` | `import { init } from './landing-bg/index.js'` |
| `themes/butterfly/layout/landing.pug` | 470vh 三段 DOM |
| `source/css/landing.css` | 段高、pointer-events、M1、act-ocean |
| `source/models/landing/swordsman.glb` | 剑客模型（实现期占位→正式） |
| `source/img/landing/mobile/act{1,2,3}.webp` | 移动静帧 |

---

### Task 1: 滚动常量与 ScrollDirector（可单测）

**Files:**
- Create: `source/js/landing-bg/constants.js`
- Create: `source/js/landing-bg/scroll-director.js`
- Create: `scripts/test-scroll-director.mjs`

- [ ] **Step 1: 编写 constants**

`source/js/landing-bg/constants.js`:

```js
export const ACT_VH = [200, 160, 110]
export const TOTAL_VH = ACT_VH.reduce((a, b) => a + b, 0) // 470
export const BOUNDARY_12_VH = ACT_VH[0] // 200
export const BOUNDARY_23_VH = ACT_VH[0] + ACT_VH[1] // 360
export const BOUNDARY_12 = BOUNDARY_12_VH / TOTAL_VH
export const BOUNDARY_23 = BOUNDARY_23_VH / TOTAL_VH
export const BLEND_VH = 20
export const BLEND_HALF_VH = BLEND_VH / 2
export const BLEND_HALF = BLEND_HALF_VH / TOTAL_VH

export const MOBILE_MQ = '(max-width: 768px)'
export const SKILL_COOLDOWN_MS = 1200
export const OCEAN_INTERACTIVE_BLEND = 0.85

export const PALETTE = {
  fogSpace: 0x050810,
  fogCity: 0x080612,
  fogOcean: 0x041018,
  neonCyan: 0x00f5ff,
  neonMagenta: 0xff2a6d
}
```

- [ ] **Step 2: 编写 computeScrollState**

`source/js/landing-bg/scroll-director.js`:

```js
import {
  BOUNDARY_12,
  BOUNDARY_23,
  BLEND_HALF,
  OCEAN_INTERACTIVE_BLEND
} from './constants.js'

function smoothstep (t) {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

function computeBlend (progress, center) {
  const lo = center - BLEND_HALF
  const hi = center + BLEND_HALF
  if (progress <= lo) return 0
  if (progress >= hi) return 1
  return smoothstep((progress - lo) / (hi - lo))
}

export function computeScrollState (scrollY, maxScroll) {
  const progress = maxScroll <= 0 ? 0 : Math.max(0, Math.min(1, scrollY / maxScroll))
  const blend12 = computeBlend(progress, BOUNDARY_12)
  const blend23 = computeBlend(progress, BOUNDARY_23)

  let actIndex = 1
  if (progress >= BOUNDARY_23) actIndex = 3
  else if (progress >= BOUNDARY_12) actIndex = 2

  return {
    progress,
    blend12,
    blend23,
    actIndex,
    oceanInteractive: blend23 >= OCEAN_INTERACTIVE_BLEND
  }
}

const CAMERA_KEYS = [
  { p: 0.0, pos: [0, 6, 22], look: [0, 2, -8], fov: 58 },
  { p: 0.32, pos: [2, 4, 14], look: [0, 1, -18], fov: 56 },
  { p: 0.43, pos: [0, 3, 10], look: [0, 2, -28], fov: 55 },
  { p: 0.55, pos: [-1, 2.5, 6], look: [0, 1.5, -32], fov: 54 },
  { p: 0.72, pos: [0, 2, 4], look: [0, 0, -36], fov: 52 },
  { p: 0.78, pos: [0, 1, 2], look: [0, -0.5, -38], fov: 50 },
  { p: 1.0, pos: [0, 0.5, 0], look: [0, 0, -20], fov: 48 }
]

function lerp (a, b, t) { return a + (b - a) * t }

export function computeCameraPose (progress) {
  let i = 0
  while (i < CAMERA_KEYS.length - 2 && progress > CAMERA_KEYS[i + 1].p) i++
  const a = CAMERA_KEYS[i]
  const b = CAMERA_KEYS[i + 1]
  const t = b.p === a.p ? 0 : (progress - a.p) / (b.p - a.p)
  return {
    position: a.pos.map((v, j) => lerp(v, b.pos[j], t)),
    lookAt: a.look.map((v, j) => lerp(v, b.look[j], t)),
    fov: lerp(a.fov, b.fov, t)
  }
}
```

- [ ] **Step 3: 编写并运行单测脚本**

`scripts/test-scroll-director.mjs`:

```js
import assert from 'node:assert/strict'
import { computeScrollState } from '../source/js/landing-bg/scroll-director.js'
import { BOUNDARY_12, BOUNDARY_23, BLEND_HALF } from '../source/js/landing-bg/constants.js'

const max = 1000
assert.equal(computeScrollState(0, max).blend12, 0)
assert.equal(computeScrollState(max, max).blend23, 1)

const mid12 = Math.round(BOUNDARY_12 * max)
assert.ok(computeScrollState(mid12 - BLEND_HALF * max, max).blend12 < 1)
assert.ok(computeScrollState(mid12 + BLEND_HALF * max, max).blend12 > 0)

const mid23 = Math.round(BOUNDARY_23 * max)
assert.equal(computeScrollState(mid23 - BLEND_HALF * max - 1, max).actIndex, 2)
assert.equal(computeScrollState(mid23 + BLEND_HALF * max + 1, max).actIndex, 3)

console.log('scroll-director tests passed')
```

Run: `node scripts/test-scroll-director.mjs`  
Expected: `scroll-director tests passed`

- [ ] **Step 4: Commit**

```bash
git add source/js/landing-bg/constants.js source/js/landing-bg/scroll-director.js scripts/test-scroll-director.mjs
git commit -m "feat(landing-bg): add scroll director with unit tests"
```

---

### Task 2: DOM 三段结构与 CSS

**Files:**
- Modify: `themes/butterfly/layout/landing.pug`
- Modify: `source/css/landing.css`

- [ ] **Step 1: 重构 landing.pug**

将结构改为：

```pug
body.page-landing
  ...
  #landing
    #landing-foreground
      section.act-1.landing-hero#landing-hero(min-height via CSS)
        .landing-hero-inner
          //- 删除 #landing-theme-toggle 及底部 theme toggle script
          img.landing-avatar(...)
          h1.landing-name ...
          ...
          a.landing-scroll-hint(href='#landing-content' ...)
      section.act-2.act-spacer(aria-hidden='true')
      section.act-3#landing-content.landing-content
        .landing-content-inner
          != page.content
    footer.landing-footer ...
  script(type='module' src=url_for('/js/bg-tech.js'))
  script.
    document.documentElement.setAttribute('data-theme', 'dark')
```

删除原 `header.landing-hero` 包裹在 `#landing` 直接子级的写法；删除 theme toggle 按钮与 IIFE。

- [ ] **Step 2: 更新 landing.css 核心规则**

```css
#landing {
  min-height: 470vh;
  position: relative;
}

#landing-foreground {
  pointer-events: none;
}

#landing-foreground a,
#landing-foreground button {
  pointer-events: auto;
}

.act-1.landing-hero { min-height: 200vh; }
.act-2.act-spacer { min-height: 160vh; }
.act-3.landing-content { min-height: 110vh; }

body.page-landing.act-ocean {
  cursor: none;
}

/* 删除或注释全部 [data-theme='light'] .page-landing 规则 */
```

调整 `.landing-content`：在 act-3 内垂直居中或 `padding-top: 15vh`，保证 110vh 内可读。

- [ ] **Step 3: 本地验证 DOM**

Run: `pnpm run server`  
打开 `http://localhost:4000/`  
Expected: 页面可滚动约 470vh；DevTools 可见 `.act-1/2/3`；无主题切换按钮；`html[data-theme="dark"]`。

- [ ] **Step 4: Commit**

```bash
git add themes/butterfly/layout/landing.pug source/css/landing.css
git commit -m "feat(landing): restructure 470vh three-act DOM, lock dark theme"
```

---

### Task 3: landing-bg 入口与渲染循环（灰盒三 Group）

**Files:**
- Create: `source/js/landing-bg/index.js`
- Modify: `source/js/bg-tech.js`（替换为薄入口）

- [ ] **Step 1: 重写 bg-tech.js**

```js
import { initLandingBackground } from './landing-bg/index.js'

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLandingBackground)
} else {
  initLandingBackground()
}
```

- [ ] **Step 2: 实现 index.js 骨架**

```js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.172.0/build/three.module.js'
import { MOBILE_MQ, PALETTE } from './constants.js'
import { computeScrollState, computeCameraPose } from './scroll-director.js'
import { createSpaceScene } from './scenes/space.js'
import { createCityScene } from './scenes/city.js'
import { createOceanScene } from './scenes/ocean.js'

function shouldSkip () {
  if (window.__landingBgInited) return true
  if (!document.body.classList.contains('page-landing')) return true
  if (window.matchMedia(MOBILE_MQ).matches) return true
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return false
}

function maxScroll () {
  return Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
}

export function initLandingBackground () {
  if (shouldSkip()) return

  const canvas = document.createElement('canvas')
  canvas.id = 'bg-tech-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.prepend(canvas)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(PALETTE.fogSpace, 0.028)

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 200)
  const lookTarget = new THREE.Vector3()

  const space = createSpaceScene()
  const city = createCityScene()
  const ocean = createOceanScene()
  scene.add(space.group, city.group, ocean.group)

  let scrollState = computeScrollState(0, maxScroll())

  function applyScrollState (state) {
    city.group.visible = state.blend12 > 0.001 || state.actIndex >= 2
    ocean.group.visible = state.blend23 > 0.001 || state.actIndex >= 3
    space.group.traverse(o => {
      if (o.material && 'opacity' in o.material) {
        o.material.transparent = true
        o.material.opacity = 1 - state.blend12
      }
    })
    city.group.traverse(o => {
      if (o.material && 'opacity' in o.material) {
        o.material.transparent = true
        o.material.opacity = state.blend12 * (1 - state.blend23)
      }
    })
    ocean.group.traverse(o => {
      if (o.material && 'opacity' in o.material) {
        o.material.transparent = true
        o.material.opacity = state.blend23
      }
    })
    document.body.classList.toggle('act-ocean', state.oceanInteractive)

    const fogColor = new THREE.Color(PALETTE.fogSpace)
      .lerp(new THREE.Color(PALETTE.fogCity), state.blend12)
      .lerp(new THREE.Color(PALETTE.fogOcean), state.blend23)
    scene.fog.color.copy(fogColor)
    renderer.setClearColor(fogColor)

    const pose = computeCameraPose(state.progress)
    camera.position.set(...pose.position)
    lookTarget.set(...pose.lookAt)
    camera.lookAt(lookTarget)
    camera.fov = pose.fov
    camera.updateProjectionMatrix()
  }

  function onScroll () {
    scrollState = computeScrollState(window.scrollY, maxScroll())
    applyScrollState(scrollState)
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    onScroll()
  })

  function animate () {
    requestAnimationFrame(animate)
    space.update?.(performance.now())
    city.update?.(performance.now())
    ocean.update?.(performance.now())
    renderer.render(scene, camera)
  }

  onScroll()
  animate()
  window.__landingBgInited = true
}
```

- [ ] **Step 3: 三场景灰盒 export**

各文件先返回单色 `Group` 占位：

`scenes/space.js` — 蓝色球 + 标签；`scenes/city.js` — 绿色地面；`scenes/ocean.js` — 青色平面。

```js
// scenes/space.js 示例
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.172.0/build/three.module.js'
export function createSpaceScene () {
  const group = new THREE.Group()
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 1 })
  )
  mesh.position.set(0, 2, -10)
  group.add(mesh)
  return { group, update () {} }
}
```

- [ ] **Step 4: 验证灰盒转场**

Run: `pnpm run server`，桌面宽度打开 `/`  
滚动 0→470vh：应看到蓝→绿→青渐变混合；`body.act-ocean` 在幕 3 出现。

- [ ] **Step 5: Commit**

```bash
git add source/js/bg-tech.js source/js/landing-bg/
git commit -m "feat(landing-bg): WebGL shell with three-act blend graybox"
```

---

### Task 4: SceneSpace — 星空与剑客占位

**Files:**
- Modify: `source/js/landing-bg/scenes/space.js`
- Create: `source/js/landing-bg/character/swordsman.js`（占位 capsule）

- [ ] **Step 1: 星空粒子 + 天空 dome shader**（参考旧 `bg-tech.js` `createSkyDome`，改 PALETTE）

- [ ] **Step 2: swordsman.js 占位体**

```js
export function createSwordsmanPlaceholder () {
  const group = new THREE.Group()
  group.name = 'Swordsman'
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 1.2, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xcccccc, emissive: 0x112233 })
  )
  body.position.y = 1
  group.add(body)
  const sword = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 1.4, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x00f5ff })
  )
  sword.position.set(0.5, 1.2, 0)
  sword.name = 'Sword'
  group.add(sword)
  group.userData.hitTargets = [body, sword]
  return {
    group,
    updateExit (blend12) {
      if (blend12 > 0.5) group.position.y += blend12 * 0.08
      if (blend12 > 0.85) group.visible = false
      else group.visible = true
    },
    isVisible () { return group.visible }
  }
}
```

- [ ] **Step 3: 将剑客挂到 space group，朝 +Z 缓慢前移**

- [ ] **Step 4: 验证** — 首屏可见灰模剑客；滚到 190–210vh 剑客上飞消失。

- [ ] **Step 5: Commit** — `feat(landing-bg): space scene and swordsman placeholder`

---

### Task 5: SceneCity — 中等密度夜城

**Files:**
- Modify: `source/js/landing-bg/scenes/city.js`
- 可复用旧 `bg-tech.js` 中 `createBuilding`、`createCityscape`、`createGridField` 逻辑，迁入并简化

- [ ] **Step 1: 实例化楼宇 + 4 栋地标**

- [ ] **Step 2: 立交桥模块** — `BoxGeometry` 组合 L 形，z 方向重复 2 段

- [ ] **Step 3: 车流 4 条路径** — `CatmullRomCurve3` + box mesh 沿 curve 移动

- [ ] **Step 4: 行人 2 条路径** — capsule billboard

- [ ] **Step 5: 霓虹全息牌 2 块** — CanvasTexture

- [ ] **Step 6: 验证** — progress 0.43–0.72 城市清晰可见，车/人在动（reduce-motion 时停）

- [ ] **Step 7: Commit** — `feat(landing-bg): cyber city scene medium density`

---

### Task 6: SceneOcean — 鱼、水母、幕 3 交互

**Files:**
- Create: `source/js/landing-bg/interaction/pointer.js`
- Modify: `source/js/landing-bg/scenes/ocean.js`
- Modify: `source/js/landing-bg/index.js`（接入 pointer）

- [ ] **Step 1: pointer.js**

```js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.172.0/build/three.module.js'

export function createPointerSystem ({ camera, domElement, swordsman, skills, getScrollState }) {
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const mouseWorld = new THREE.Vector3()
  const light = new THREE.PointLight(0x7df9ff, 1, 12)
  const lightMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x7df9ff })
  )

  function onPointerMove (e) {
    const state = getScrollState()
  ndc.x = (e.clientX / window.innerWidth) * 2 - 1
  ndc.y = -(e.clientY / window.innerHeight) * 2 + 1
    if (state.oceanInteractive) {
      raycaster.setFromCamera(ndc, camera)
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      raycaster.ray.intersectPlane(plane, mouseWorld)
    }
  }

  function onPointerDown (e) {
    if (!swordsman.isVisible()) return
    ndc.x = (e.clientX / window.innerWidth) * 2 - 1
    ndc.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(ndc, camera)
    const hits = raycaster.intersectObjects(swordsman.group.userData.hitTargets, true)
    if (hits.length) skills.triggerRandom()
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerdown', onPointerDown)

  return {
    light,
    lightMesh,
    getFollowTarget () { return mouseWorld.clone() },
    dispose () {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }
}
```

- [ ] **Step 2: ocean.js** — InstancedMesh 鱼；3 水母（1 主跟随 `getFollowTarget()`）

- [ ] **Step 3: index.js** — `oceanInteractive` 时 scene.add(light)；否则移除

- [ ] **Step 4: 验证** — 滚到幕 3：光标消失、光点跟随、主水母靠近鼠标

- [ ] **Step 5: Commit** — `feat(landing-bg): ocean scene and pointer interaction`

---

### Task 7: 三技能 VFX

**Files:**
- Create: `source/js/landing-bg/character/skills.js`
- Modify: `source/js/landing-bg/character/swordsman.js`

- [ ] **Step 1: skills.js 状态机**

```js
const SKILLS = ['draw', 'smash', 'storm']
let busy = false
let lastAt = 0
import { SKILL_COOLDOWN_MS } from '../constants.js'

export function createSkills ({ swordsmanGroup, scene }) {
  return {
    isBusy: () => busy,
    triggerRandom () {
      if (busy || Date.now() - lastAt < SKILL_COOLDOWN_MS) return
      const pick = SKILLS[Math.floor(Math.random() * SKILLS.length)]
      busy = true
      lastAt = Date.now()
      runSkill(pick, { swordsmanGroup, scene }).finally(() => { busy = false })
    }
  }
}
```

- [ ] **Step 2: 拔刀斩** — additive `PlaneGeometry` 扫过 + 剑 emissive 脉冲 600ms

- [ ] **Step 3: 崩山击** — group.position.y tween + 地面 Ring 扩散 900ms

- [ ] **Step 4: 极·鬼剑术（暴风式）** — 8 条 `QuadraticBezierCurve3` 刀光绕 Y 旋转 1800ms

- [ ] **Step 5: 验证** — 点击剑客 Console 无报错；三技能随机可见；1.2s 内连点无效

- [ ] **Step 6: Commit** — `feat(landing-bg): swordsman three skill VFX`

---

### Task 8: 写实剑客 glTF 接入

**Files:**
- Add: `source/models/landing/swordsman.glb`
- Modify: `source/js/landing-bg/character/swordsman.js`

- [ ] **Step 1: 准备模型**

在 Blender 中基于 CC0 人形改模（或自制）：修长、束发/长发、宽袖；导出 glTF + Draco。  
若模型未就绪：先用占位 capsule，本 task 可标记 blocked，不阻塞 Task 1–7。

- [ ] **Step 2: GLTFLoader**

```js
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.172.0/examples/jsm/loaders/GLTFLoader.js'
const loader = new GLTFLoader()
loader.load('/models/landing/swordsman.glb', (gltf) => {
  placeholder.replaceWith(gltf.scene)
  // 注册 hitTargets: gltf.scene 内 body + sword mesh
})
```

- [ ] **Step 3: 动画 clip** — `fly` 循环；技能时 `AnimationMixer.clipAction`

- [ ] **Step 4: Commit** — `feat(landing-bg): replace swordsman placeholder with glTF`

---

### Task 9: Post-processing 与性能档位

**Files:**
- Create: `source/js/landing-bg/post/composer.js`
- Modify: `source/js/landing-bg/index.js`

- [ ] **Step 1: UnrealBloomPass**（仅 `deviceMemory > 4` 且无 reduce-motion）

- [ ] **Step 2: Mid 档** — 关 Bloom，城市车减半

- [ ] **Step 3: Low 档** — 帧率监测 3s < 20fps 时触发，关 Reflector/减鱼 instancing

- [ ] **Step 4: Commit** — `feat(landing-bg): quality tiers and bloom`

---

### Task 10: 移动端 M1 与 WebGL fallback

**Files:**
- Create: `source/img/landing/mobile/act1.webp`（占位渐变图亦可）
- Create: `source/img/landing/mobile/act2.webp`
- Create: `source/img/landing/mobile/act3.webp`
- Modify: `source/css/landing.css`

- [ ] **Step 1: CSS 移动背景**

```css
@media (max-width: 768px) {
  .act-1 { background: url('/img/landing/mobile/act1.webp') center/cover no-repeat; }
  .act-2 { background: url('/img/landing/mobile/act2.webp') center/cover no-repeat; }
  .act-3 { background: url('/img/landing/mobile/act3.webp') center/cover no-repeat; }
  .landing-content-inner {
    background: rgba(8, 12, 20, 0.88);
    backdrop-filter: blur(12px);
  }
}
```

- [ ] **Step 2: index.js WebGL try/catch** — fail 时 `document.body.classList.add('landing-fallback-static')`

- [ ] **Step 3: 桌面完成后截图替换 webp**

- [ ] **Step 4: Commit** — `feat(landing): mobile M1 static backgrounds and WebGL fallback`

---

### Task 11: 清理与验收

**Files:**
- Delete or gut: 旧 `bg-tech.js` 内联逻辑（已在 Task 3 替换）
- Modify: `source/css/custom.css` — 移除 landing light 主题扫描线冲突（可选）
- Modify: `source/css/landing.css` — footer 在 act-3 内定位

- [ ] **Step 1: 跑单测** — `node scripts/test-scroll-director.mjs`

- [ ] **Step 2: 构建** — `pnpm run build` 无报错

- [ ] **Step 3: 验收清单**（对照 spec §9 逐项勾选）

| # | 检查项 |
|---|--------|
| 1 | 470vh 三幕 + 20vh 交融 |
| 2 | 剑客点击三技能 + 冷却 |
| 3 | 幕 3 光标/水母/光点 |
| 4 | 移动 M1 无 canvas |
| 5 | 无主题按钮、暗色 |
| 6 | reduce-motion 降级 |

- [ ] **Step 4: Commit** — `chore(landing): remove legacy bg-tech, complete acceptance`

---

## Spec 覆盖自检

| Spec 章节 | 对应 Task |
|-----------|-----------|
| §2 DOM 470vh | Task 2 |
| §2.3 20vh blend | Task 1 |
| §3 ScrollDirector | Task 1, 3 |
| §4 三幕视觉 | Task 4, 5, 6 |
| §5 剑客技能 | Task 4, 7, 8 |
| §6 移动 M1 | Task 10 |
| §7 性能/a11y | Task 9 |
| §2.4 暗色锁定 | Task 2 |

**占位说明：** Task 8 模型资产依赖 Blender 产出；计划允许先用 capsule 完成 Task 7 联调，模型就绪后再 Task 8。

---

## 执行方式

Plan 已保存。两种执行选项：

1. **Subagent-Driven（推荐）** — 每 Task 派生子 agent，Task 间人工/主 agent 审查  
2. **Inline Execution** — 本会话按 Task 顺序直接实现，每 2–3 Task 设检查点

请选择 **1 或 2** 开始实现。
