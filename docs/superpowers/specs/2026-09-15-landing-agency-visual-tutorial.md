# Landing 视觉品质教程：从「程序拼装」到「作品集级」

> 对照目标：[安知鱼 index](https://index.anheyu.com/) 的清晰与流畅感  
> 本站现状：`source/js/landing-bg/`（Three.js 三幕滚动背景）  
> 原则：**不抄对方打包代码，复用同一套制作管线**

---

## 0. 先建立正确心智模型

对方好看，不是因为「用了更高级的框架」，而是这四层叠在一起：

```text
① 资产层     Blender / Mixamo / 买或下的 GLB（形准、有贴图、有动画）
② 驱动层     AnimationMixer / InstancedMesh / VAT / GPU 粒子
③ 光照层     Spot/Directional + 阴影 + 环境贴图（IBL）
④ 成片层     Bloom + ToneMapping + Fog + 轻微体积光
```

你们现在已经有 ② 的骨架、③④ 的雏形（见 `index.js` 的 ACES、`post/composer.js` 的 Bloom）。  
观感差，主要卡在 **① 资产质量**，以及 **城市仍是 2D matte**。

| 幕 | 现状 | 观感问题根因 |
|----|------|--------------|
| 星空御剑 | VRM + 程序化飞剑 | 动作 clip 弱 / 刀是方块 / 灯光未服务角色 |
| 赛博夜城 | Canvas 画在 Plane 上 | **本质是海报，不是 3D 城** |
| 海底 | Lathe 旋转体鱼 + 水母 GLB | 鱼无贴图无鳍；光散射可再加强 |

**推荐推进顺序（投入产出比）：**

1. 海底换真鱼 GLB（最快看见「变好看」）  
2. 城市改成挤出楼宇 / 低模街区  
3. 剑客补高质量动画 + 真刀模型  
4.（可选）GPU 粒子 / 人群 VAT —— 最后做，难度最高

---

## 1. 工具链准备（一次性）

### 必装

| 工具 | 用途 |
|------|------|
| [Blender](https://www.blender.org/) 4.x | 修模型、烘焙、导出 glTF |
| 浏览器 Chrome + 本站 `pnpm run server` | 实机验收 |
| （可选）[Mixamo](https://www.mixamo.com/) | 角色跑、砍、待机动画 |

### 本站已有命令

```bash
pnpm run models              # 拉剑客 VRM + 水母 GLB
pnpm run models:swordsman
pnpm run models:jellyfish
pnpm run server              # 本地预览 landing
```

资产目录约定：

```text
source/models/landing/          # 运行时加载的 GLB / VRM
source/models/landing/README.md # 许可与朝向说明（务必更新）
source/js/landing-bg/constants.js  # *_MODEL_URL
```

### 导出 glTF 检查清单（每做一个资产都过一遍）

1. 单位：Blender 里约 **1 单位 = 1 米**，角色身高 ≈ 1.6–1.8  
2. 朝向：角色面朝 **+Z 或 -Z**（导入后用 `rotation.y` 微调即可）  
3. 动画：需要的 clip 命名清晰，例如 `idle_fly` / `swim` / `run`  
4. 导出：**glTF Binary (.glb)**，勾选动画；有骨骼则带 Armature  
5. 体积：单文件尽量 **&lt; 3–8 MB**（Draco 压缩可选）  
6. 许可：个人博客可公开使用（CC0 / CC-BY / Sketchfab 条款核对）

---

## 2. 阶段 A：用现有管线「先打光」（半天，不换模型）

目标：同一套烂几何体，先变得「更电影感」。改动集中在光照与后期，不动业务逻辑。

### A1. 确认后期已开

文件：`source/js/landing-bg/post/composer.js`、`index.js`

你们已有：

- `ACESFilmicToneMapping`
- `UnrealBloomPass` + 合成
- `LAYER_BLOOM` 分层 bloom

验收：

1. 打开 landing，桌面端应看到霓虹/自发光有光晕  
2. `qualityTier === 'high'` 时 bloom 更强；mid 可减弱  

调参建议（经验值，按幕微调）：

| 参数 | 星空 | 城市 | 海底 |
|------|------|------|------|
| exposure | 1.4–1.7 | 1.2–1.5 | 1.0–1.3 |
| bloom strength | 中 | 中高（霓虹） | 低中（水下散射） |
| fog 密度 | 低 | 中 | 中高 |

### A2. 每幕至少一盏「主光」+ 阴影

在对应 `scenes/*.js` 的 `create*Scene` 里：

```js
const key = new THREE.SpotLight(0xffffff, 40, 80, Math.PI / 5, 0.4, 1.2)
key.position.set(8, 14, 10)
key.castShadow = true
key.shadow.mapSize.set(1024, 1024)
key.shadow.bias = -0.001
group.add(key)
group.add(key.target)
```

同时：

- 需要吃阴影的 mesh：`castShadow = true` / `receiveShadow = true`  
- `index.js` 里已有 `renderer.shadowMap.enabled = true`，保持即可  

### A3. 环境光（IBL）

`index.js` 已用 `RoomEnvironment`。若某幕太灰：

- 略提高 `AmbientLight` 强度，或  
- 给关键物体 `envMapIntensity`（Standard/Physical 材质）

**阶段 A 完成标准：** 截图对比「开关阴影+bloom」有明显层次，而不是糊成一片。

---

## 3. 阶段 B：海底示范片（推荐第一战役，1–2 天）

目标：用 **1 条真鱼 GLB + InstancedMesh 群游** 替换 `LatheGeometry` 鱼。  
你们水母已有 GLB 路径（`JELLYFISH_MODEL_URL`），鱼按同样模式做。

### B1. 找模型

推荐来源（注意许可）：

- [Sketchfab](https://sketchfab.com/) 搜 `fish low poly` + downloadable  
- [Poly Pizza](https://poly.pizza/) / Kenney 等 CC0 包  

要求：

- 三角面尽量 &lt; 5k（要实例化几十条）  
- 带基础色贴图更好  
- 朝向最好「鼻尖朝 +X 或 +Z」（与现有 `createFishVolumeGeometry` 路径逻辑对齐时少改代码）

放到：

```text
source/models/landing/fish.glb
```

在 `constants.js` 增加：

```js
export const FISH_MODEL_URL = '/models/landing/fish.glb'
```

并在 `source/models/landing/README.md` 写上来源与许可。

### B2. 加载与实例化（对接 `scenes/ocean.js`）

现有逻辑：`createFishSchool` 用 `InstancedMesh` + 自定义 `fish-lit` 材质。  
替换思路：

1. `GLTFLoader` 加载 `fish.glb`，取第一个 `Mesh` 的 `geometry` + 原材质（或继续用你们的 `createFishBodyMaterial` 以统一受光）  
2. `geometry.rotateY(...)` / `scale.setScalar(...)` 对齐世界朝向  
3. 继续用现有 `paths` / `flocks` 更新 `setMatrixAt` —— **群游算法不用重写**  
4. 程序化 `LatheGeometry` 仅作加载失败时的 fallback（与水母一致）

伪代码：

```js
async function loadFishPrototype (url) {
  const gltf = await new GLTFLoader().loadAsync(url)
  let mesh = null
  gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o })
  // 归一化：居中、朝向、统一长度约 0.7
  return mesh
}

// createFishSchool 内：
const proto = await loadFishPrototype(FISH_MODEL_URL).catch(() => null)
const geo = proto ? proto.geometry.clone() : createFishVolumeGeometry(0)
const mat = createFishBodyMaterial(sharedUniforms) // 或 proto.material.clone()
const inst = new THREE.InstancedMesh(geo, mat, FISH_COUNT)
```

注意：`createOceanScene` 若目前是同步的，需改成 **异步创建** 或「先占位、加载完再替换 geometry」——推荐后者，避免挡住首屏星空幕。

### B3. 鱼的「不丑」最小材质

若模型自带贴图但偏平：

- 用 `MeshStandardMaterial`：`map` + 略高 `roughness`（0.6–0.85）  
- 侧光：一盏从水面斜打的 `DirectionalLight`（青色偏冷）  
- 远处雾：保持 `fogOcean`，让远鱼融进水里（层次感）

### B4. 水母保持，强化主光

`blue_jellyfish.glb` 已可用。检查：

- bloom 层：伞缘 / 核是否进 `LAYER_BLOOM`  
- 指针手电筒（`pointer.js`）只照亮附近鱼 —— 这是对方「清晰」的重要来源：**局部高光 + 大面积压暗**

**阶段 B 完成标准：** 滚到海底，鱼有贴图/鳍轮廓，近处清晰、远处融入雾；不再像果冻胶囊。

---

## 4. 阶段 C：城市从 2D matte → 3D 街区（2–4 天）

文件：`source/js/landing-bg/scenes/city.js`  
现状：`createCityMatte` 画 Canvas → `CanvasTexture` → 大平面。这是「扁」的根因。

### C1. 最低成本方案：程序化挤出楼（不买模型）

思路：

1. 保留远景 matte（天空、远山）作背景板  
2. **近中景**用一堆 `BoxGeometry` / 简单 `ExtrudeGeometry` 楼块组成 `InstancedMesh`  
3. 霓虹用 `MeshBasicMaterial` / emissive + bloom 层  
4. 地面一张大平面 `receiveShadow`

楼块布局可用种子随机（你们已有 `seeded()`）：

```js
for (let i = 0; i < 80; i++) {
  const w = 2 + rng() * 4
  const h = 6 + rng() * 28
  const d = 2 + rng() * 4
  // 沿街道网格放置，避免穿模
}
```

### C2. 进阶：导入低模 city pack

1. 找 `low poly city` / `cyberpunk buildings` GLB  
2. 在 Blender 合并、删远景、只留相机能看到的一截街道  
3. `city.glb` 放进 `source/models/landing/`  
4. `createCityScene` 里 `GLTFLoader` 加载，整体 `scale` 对齐 `CITY_LOOK`

### C3. 镜头与深度

城市要「不扁」，必须同时有：

- 相机有 **前后运动**（你们 `scroll-director` 已有 pose 样条，检查 city 段是否仍对着一张平面）  
- 建筑有 **遮挡关系**（近楼挡住远楼）  
- 可选：路面湿润反射（简单镜面平面或 SSR，后者成本高，先不做）

**阶段 C 完成标准：** 截图里能数出至少两排楼的纵深；关掉远景 matte 后场景仍成立。

---

## 5. 阶段 D：剑客「不像死板」（2–3 天）

文件：

- `character/swordsman.js`  
- `character/animator.js`  
- clip 名：`idle_fly` / `skill_draw` / `skill_smash` / `skill_storm`

### D1. 动画从哪来

路径 A（推荐）：Mixamo

1. 上传/选择人形  
2. 下载 `Idle`、`Flying`/`Superman` 类、若干 Attack（FBX）  
3. Blender 重定向到你们的 VRM/人形骨骼，导出带动画的 glb，或把 clip 合并进现有流程  

路径 B：继续 VRM，用 VRoid / UniVRM 工具链导出动画（门槛较高）

`animator.js` 已支持按名字找 clip；**有 clip 就会播，没有才走程序化技能**。所以关键是 **资产里真有这些名字**。

### D2. 换掉方块飞剑

`createFlyingSword()` 现在是 `BoxGeometry`。改为：

1. 一把低模刀 GLB（或自己在 Blender 挤出刀刃）  
2. 刀刃 `emissive` 青色，加入 `LAYER_BLOOM`  
3. 仍挂到手上的 bone（现有 `attachSwordToHand`）

### D3. 角色打光

星空幕给剑客一盏跟随的 rim light（侧逆光），轮廓立刻「立」起来：

```js
const rim = new THREE.DirectionalLight(0x88aaff, 2.5)
rim.position.set(-4, 2, -3)
swordsmanGroup.add(rim)
```

**阶段 D 完成标准：** idle 有呼吸/御剑感；点技能时看到真实骨骼动作，而不是只有特效糊一层。

---

## 6. 阶段 E：（进阶）GPU 粒子与人群 VAT

这是安知鱼「粒子云 / 奔跑人群」的核心，**不要在 A–D 完成前碰**。

### E1. GPU 粒子（适合星空、技能拖尾、水下浮游）

原理：

1. 用 `WebGLRenderTarget` / `DataTexture` 存粒子 xyz  
2. 片元/计算着色器每帧更新位置  
3. `Points` 顶点着色器采样位置纹理画点  

学习路径：

- Three.js 官方 examples：`webgl_gpgpu_particles`  
- 对方同源思路：`u_positionTexture` 驱动 `gl_PointSize`

落地建议：先做 **技能刀光拖尾 200–500 点**，不要一上来上万。

### E2. VAT 奔跑人群（可选，城市氛围）

原理：把跑步动画每帧顶点位置烘焙进贴图，运行时用实例 + shader 采样，**无需每人一个 Skeleton**。

工具：

- Blender VAT 插件（搜 Vertex Animation Texture）  
- 导出：静态 mesh + position/normal 纹理  

本站若只做「远处几个剪影跑动」，用 **InstancedMesh + 单一 run clip 的 GPU skinning** 通常就够；VAT 留给真要上百人时。

---

## 7. 性能与移动端（全程遵守）

你们已有：`MOBILE_MQ` 跳过 WebGL、`qualityTier`、幕懒加载（`shouldPreloadCity/Ocean`）。新增资产时：

| 规则 | 做法 |
|------|------|
| 单幕同时可见 | 远幕降 `visible` 或停 tick（已有 ActVisual 思路） |
| 实例化 | 鱼/楼/车优先 `InstancedMesh` |
| 贴图 | 1024 足够；能 512 就 512 |
| 阴影 | 同时最多 1–2 盏 castShadow 灯 |
| Bloom | mid 档减弱或关 |
| 失败 | GLB 404 → 程序化 fallback，不能白屏 |

---

## 8. 验收清单（每阶段打勾）

### 通用

- [ ] Desktop landing：60fps 附近（Chrome Performance，滚动时不掉到 30 以下太久）  
- [ ] 无模型文件时控制台有 warn，画面仍有 fallback  
- [ ] `README.md` 写了资产来源与许可  

### 海底（B）

- [ ] 鱼为 GLB，近处有鳍/贴图可读性  
- [ ] 群游仍用原 flock 逻辑  
- [ ] 手电筒局部照亮有效  

### 城市（C）

- [ ] 至少近景是真实 3D mesh，不是整屏一张图  
- [ ] 滚动时有遮挡与纵深  

### 剑客（D）

- [ ] idle 来自动画 clip（或明显优于纯骨骼摆 pose）  
- [ ] 飞剑非 Box 占位  
- [ ] 技能能触发 clip + 现有 VFX  

---

## 9. 建议的一周节奏

| 天 | 做什么 |
|----|--------|
| D1 | 阶段 A 打光调参 + 截图 before/after |
| D2–D3 | 阶段 B 鱼 GLB + 异步加载 + README |
| D4–D5 | 阶段 C 挤出楼或 city.glb |
| D6–D7 | 阶段 D 动画与真刀 |
| 以后 | 阶段 E 粒子 / VAT |

---

## 10. 和现有文档的关系

- 架构与滚动：`docs/superpowers/specs/2026-05-22-landing-triple-scene-design.md`  
- 实现计划：`docs/superpowers/plans/2026-05-22-landing-triple-scene.md`  
- **本文**：视觉品质升级管线（资产 / 光 / 后期），不改变「单 Canvas 三幕」架构  

实现时请仍走「改一幕 → 验收 → 再下一幕」，避免三幕同时大改导致无法对比效果。

---

## 附录：对方技术对照（只读参考）

从 [index.anheyu.com](https://index.anheyu.com/) 打包脚本可见的关键词：

- Three.js r112 + TweenLite  
- `female.glb` / `animation.glb` / `room.glb` / `beethoven.glb`  
- `u_vaTexture`（VAT）  
- `u_positionTexture`（GPU 粒子）  
- SpotLight 阴影 + Bloom + 体积光 raymarch  
- 分 DOM 段的多 Visual（`about-hero`、`featured`、`home-video`…）  

本站等价物：`landing-bg` 的 Space / City / Ocean + `ScrollDirector` + `createPostPipeline`。
