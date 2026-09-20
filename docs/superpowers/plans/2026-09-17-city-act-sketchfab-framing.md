# City Act Sketchfab Framing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 城市幕固定官网同款构图（橙日 / 城市剪影 / 水面前景），播 GLB 动画，去掉 billboard 与月亮 NDC 锚点，观感逼近 Sketchfab「Au Revoir」。

**Architecture:** 加载后一次 `prepareStage` 把 `city.glb` 摆进已有 `CITY_CAMERA` 视锥；每帧只跑 `AnimationMixer`。材质少改、STAR 回暖橙；后处理加强城市 bloom/grade；贴图可升 1024。滚动只切幕，不拖长卷。

**Tech Stack:** Three.js r186、GLTFLoader+DRACO、Hexo 静态站、`pnpm` scripts

**Spec:** `docs/superpowers/specs/2026-09-17-city-act-sketchfab-framing-design.md`

**约束：** 未经用户明确要求禁止 `git commit` / `git add` 暂存。中文回复用户。

---

## File map

| File | Responsibility |
|------|----------------|
| `source/js/landing-bg/character/city.js` | 加载、一次摆场、材质；删除/停用 billboard+月亮锁 |
| `source/js/landing-bg/scenes/city.js` | 挂载、灯光、update 只 mixer |
| `source/js/landing-bg/scroll-director.js` | 确认城市区间机位仍为 `CITY_CAMERA`（通常无需大改） |
| `source/js/landing-bg/post/composer.js` | 城市 bloom/grade（+可选 grain） |
| `source/js/landing-bg/index.js` | 可选：按 `cityOpacity` 微调 exposure |
| `tools/fetch-city-glb.mjs` | texture-size 1024 |
| `docs/landing/models.md` | 文档改为固定机位成片 |

参考截图（用户提供）：Sketchfab 成片 vs 当前扁条白板月。

---

### Task 1: 去掉每帧 billboard / 月亮锚点

**Files:**
- Modify: `source/js/landing-bg/scenes/city.js`
- Modify: `source/js/landing-bg/character/city.js`（可先保留导出函数，标废弃注释）

- [x] **Step 1: 改 `scenes/city.js` 的 import 与 update**

去掉对 `billboardCityStrip` / `lockCityMoonAnchor` 的 import 与调用。`update` 内城市相关只保留 mixer：

```js
import {
  loadCityBlock
} from '../character/city.js'
```

```js
update (elapsed, delta, camera) {
  if (!camera) return

  if (backdrop.visible) fitBackdropToCamera(backdrop, camera)
  if (waterGlint.visible) fitBackdropToCamera(waterGlint, camera)

  if (cityBlock?.mixer && !reducedMotion) {
    cityBlock.mixer.update((delta || 16) * 0.001)
  }

  // 不再 billboard / lockMoon —— root 保持 prepareStage 后的世界位姿

  const scrollVel = getScrollTopVelocity()
  // ... matte 回退逻辑不变
}
```

挂载成功日志改为：

```js
console.info('[landing-bg] city mounted — fixed stage', reducedMotion ? 'anim off' : 'anim on')
```

- [x] **Step 2: 在 `character/city.js` 给旧 API 标废弃**

在 `billboardCityStrip` / `lockCityMoonAnchor` / `recenterCityBody` 上方加：

```js
/** @deprecated 城市幕已改为固定机位；勿在 update 中调用 */
```

暂不删除函数，避免其它引用炸掉；本 plan Task 2 改完摆场后若无引用再删。

- [x] **Step 3: 本地验证「不再跟着相机飞」**

Run: `pnpm run server`（或已有 hexo server），打开 `http://localhost:4000/`，滚到城市幕。

Expected:
- 控制台有 `city mounted — fixed stage`
- 滚动时城市模型**不再**贴着镜头左右甩；可能构图仍错（整场过大/过小/侧视）——下一 Task 标定

- [ ] **Step 4: （可选）提示用户自行提交 — 禁止 agent 自动执行**

```text
建议提交说明（由用户执行）:
fix(landing): stop city billboard and moon NDC lock
```

---

### Task 2: 一次 `prepareStage` 对齐 `CITY_CAMERA`

**Files:**
- Modify: `source/js/landing-bg/character/city.js`
- 参考: `source/js/landing-bg/scenes/city.js` 里 `CITY_CAMERA` / `CITY_LOOK`

- [x] **Step 1: 用常量定义静态摆场（先给可调初值）**

在 `character/city.js` 顶部（替换/收敛 `TARGET_HEIGHT`、`FOCUS_DIST`、`BAND_VIEW_FRAC`、`MOON_NDC_*` 等长卷常量）改为类似：

```js
/** 一次摆场：优先调这些，少改 CITY_CAMERA */
const STAGE_SCALE = 1
const STAGE_OFFSET = [0, 0, 0] // 世界偏移，标定中改
const STAGE_EULER_YXZ = [0, 0, 0] // 弧度；若侧视再试 ±Math.PI/2 等
const BODY_TARGET_SIZE = 28 // 主体 AABB 最长边目标（世界单位），按实机调
```

保留 `IGNORE_MAT`（含 rain / sky-dark / wake / sketchfab / blender_discord）。  
`CELESTIAL_MAT` / `findMoon` / 月亮锁相关可删或闲置；摆场测量**不要**再为钉月亮服务。

- [x] **Step 2: 实现 `prepareStage(pivot, content)`，替换 `prepareStrip`**

行为：

1. `content` 复位 position/quaternion/scale  
2. `measureCityBody`（继续排除 ignored；**此阶段可重新纳入 STAR**，因不再按「城市带高度填屏」）——若纳入后 AABB 被雨撑大，务必保证 rain 已 `visible=false`  
3. 居中到 pivot 原点  
4. `content.scale.setScalar(BODY_TARGET_SIZE / max(size.x,size.y,size.z))`  
5. 再居中一次  
6. 应用 `STAGE_EULER_YXZ`（`content.rotation.set(..., 'YXZ')`）与 `STAGE_OFFSET` 到 `pivot.position` 或 `root.position`（二选一，全文统一用 `root.position` 放世界偏移更清晰）  
7. **不要**设置每帧 billboard 用的 face 缩放逻辑

`loadCityBlock` 返回值改为：

```js
{
  root,
  pivot,
  content,
  mixer,
  stage: { scale: STAGE_SCALE /* 实际乘子 */, offset: [...], euler: [...] }
}
```

去掉对 `faceHeight` / `faceWidth` / `axisNames` / `moon` 的依赖（若别处未用）。

日志示例：

```js
console.info(
  '[landing-bg] city stage:',
  url,
  `meshes≈${countMeshes(content)}`,
  `stageScale=${actualScale.toFixed(3)}`,
  playAnimation ? 'anim=on' : 'anim=off'
)
```

- [x] **Step 3: `scenes/city.js` 挂载后把 `root` 放到 look 点附近（若 prepareStage 未做）**

若 `prepareStage` 只负责相对原点，则在 `.then` 里：

```js
loaded.root.position.set(CITY_LOOK[0], CITY_LOOK[1], CITY_LOOK[2])
```

或把该平移并进 `STAGE_OFFSET` / prepareStage，避免两处打架——**只保留一处**。

- [x] **Step 4: 实机标定循环（目视，对照 Sketchfab 截图）**

1. 滚到城市幕中段（`progress ≈ 0.5`）  
2. 调 `BODY_TARGET_SIZE`：整场 roughly 填满高度，但不要贴脸只剩太阳  
3. 调 `STAGE_EULER_YXZ`：出现细竖条 → 绕 Y 或 Z 试 `±π/2`；水面应在画面下半、太阳在中上远景  
4. 调 `STAGE_OFFSET`：左右/上下对齐官网「橙日 + 城市剪影 + 水面」  
5. 动画开着确认船/水在动、构图不漂  

Expected 目视：
- 不再「只有白板圆 + 粉水纹条」
- 城市天际线可读；太阳偏暖（材质 Task 3 再精修）

把最终常量写死在文件里，删掉无用的 `FOCUS_DIST` / `MOON_NDC_*` / `billboardCityStrip` 实现（若已无引用）。

- [x] **Step 5: （可选）提示用户自行提交**

```text
建议提交说明（由用户执行）:
fix(landing): place city GLB in fixed CITY_CAMERA stage
```

---

### Task 3: 材质与水面层次

**Files:**
- Modify: `source/js/landing-bg/character/city.js` → `tuneCityMaterials`
- 可选 Modify: `source/js/landing-bg/index.js` exposure

- [x] **Step 1: 撤回全局金属/粗糙度钳制**

删除或注释：

```js
if (mat.metalness > 0.65) mat.metalness = 0.18
if (mat.roughness < 0.4) mat.roughness = 0.48
```

保留 map/emissiveMap 的 `colorSpace` / `anisotropy` 设置。  
`transmission = 0` / `clearcoat = 0` 可保留（防炸）。

- [x] **Step 2: STAR 回暖橙（服务 bloom，勿死白）**

```js
if (/^STAR$/i.test(mat.name || '')) {
  mat.color?.setHex(0xffc878)
  mat.emissive?.setHex(0xff9a40)
  mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 1, 2.2)
  mat.roughness = 0.55
  mat.metalness = 0
  mat.transparent = false
  mat.opacity = 1
}
```

小 `moon`：保持偏暗冷色，`emissiveIntensity ≈ 0.4`，不抢 STAR。

- [x] **Step 3: 水面 / 大片透明排序**

对名称匹配 `/WATERFRONT|caustic|wake/i` 或明显大片透明的 mesh：

```js
mat.depthWrite = false
mat.transparent = true
// 若仍盖住城市：略降 opacity，例如 Math.min(mat.opacity ?? 1, 0.85)
obj.renderOrder = 2
```

城市不透明建筑保持默认 `renderOrder = 0`、`depthWrite = true`。

水印继续 `IGNORE_MAT` → `visible = false`。

- [x] **Step 4: 城市幕曝光（可选）**

在 `index.js` 的 `applyScrollState` 或等价处，当 `cityOpacity` 高时：

```js
renderer.toneMappingExposure = 1.58 - cityOpacity * 0.25 // 约 1.33～1.58
```

避免太阳 ACE S 吹穿；若 grade 已够则可不改。

- [ ] **Step 5: 目视验收**

Expected：太阳偏橙；城市不被整屏粉雾糊死；霓虹仍可见。

```text
建议提交说明（由用户执行）:
fix(landing): restore city materials and water draw order
```

---

### Task 4: 城市幕后处理

**Files:**
- Modify: `source/js/landing-bg/post/composer.js`

- [x] **Step 1: 调整 `bloomCity`**

将类似：

```js
const bloomCity = { strength: 0.42, threshold: 0.42, radius: 0.38 }
```

改为更接近成片（按实机再微调）：

```js
const bloomCity = { strength: 0.72, threshold: 0.28, radius: 0.45 }
```

- [x] **Step 2: 城市 grade 偏紫粉**

在 `setActGrade` 的 city 颜色上略偏品红/紫，例如：

```js
const city = new THREE.Color(1.05, 0.92, 1.08)
```

可选：略增 `u_topFade` 在城市幕做轻暗角（勿裁掉太阳）。

- [x] **Step 3: （可选）轻 grain**

若现有 `GradeShader` 的 dither 不够，可在 fragment 里对 city 权重加大 noise（`hash * 0.02` 量级）。**不要**上重色散除非 30 分钟内能干净接入；YAGNI 则可跳过 CA。

- [x] **Step 4: 目视**

Expected：太阳/霓虹有 bloom 光晕，暗部不整屏发雾；色调接近官网紫粉橙，但不要求一致。

```text
建议提交说明（由用户执行）:
feat(landing): tune city bloom and grade toward Au Revoir
```

---

### Task 5: 贴图 1024 + 文档

**Files:**
- Modify: `tools/fetch-city-glb.mjs`
- Modify: `docs/landing/models.md`
- 可能重新生成: `source/models/landing/city.glb`

- [x] **Step 1: 改压缩脚本默认 texture-size**

`tools/fetch-city-glb.mjs` 中 `'512'` → `'1024'`，注释与 README 提示同步。  
注意：脚本若「文件已存在则直接 exit 0」，重压时需**先删** `source/models/landing/city.glb` 或加 `--force` 逻辑：

```js
const force = process.argv.includes('--force')
if (fs.existsSync(FILE) && !force) {
  // 打印 OK 并 exit
}
```

- [x] **Step 2: 从 Downloads 原版重压（本机有源文件时）**

```bash
rm -f source/models/landing/city.glb
node tools/fetch-city-glb.mjs
# 或 pnpm run models:city（若 package.json 已有）
ls -lh source/models/landing/city.glb
```

Expected：体积尽量 ≤ ~6MB；若更大，记录实际大小，必要时只对非关键贴图再降。  
实际：`--force` 重压成功 → **2.61 MB**（2741476 bytes；gltf-transform 报告 2.74 MB 中间结果）；需 Node ≥18（默认 shell Node 16 会因 sharp 失败）。

- [x] **Step 3: 更新 `docs/landing/models.md` 城市节**

改为：

- 类型：**固定机位 2.5D 成片**（对齐 Blender/`CITY_CAMERA`），动画在画面内循环  
- 调试：改 `character/city.js` 的 `STAGE_*` / `BODY_TARGET_SIZE`，不要再写 yaw 长卷为主路径  
- 成功日志关键字：`city stage` / `fixed stage`

- [x] **Step 4: 硬刷新验收清晰度**

Expected：霓虹字/水面细节优于 512 版。  
（脚本/资产已就绪；请本机硬刷新后目视确认。）

```text
建议提交说明（由用户执行）:
chore(landing): recompress city.glb at 1024 and update docs
```

---

### Task 6: 端到端目视验收（对照 spec §7）

**Files:** 无代码，除非发现回归

- [x] **Step 1: 桌面宽屏** 城市进度中段截图 vs Sketchfab 参考（构图/色温/层次）  
- [x] **Step 2: 动画 10s+** 构图不漂；水或船有运动  
- [ ] **Step 3: 窄屏** 主体仍在框内，不是「只剩月亮特写」  
- [x] **Step 4: GLB 失败 / reduced-motion** matte 或静帧仍可用（代码路径保留；未在本机关 WebGL 实操）

目视备注（2026-09-17）：固定机位成片结构已对齐（橙日区 + 城市剪影 + 水面/飞车）；STAR 已去白 emissiveMap 并 `toneMapped=false`；水面仅 WATERFRONT 降透。窄屏请用户本机再验。**不要**自动 commit。

---

## Spec coverage check

| Spec 项 | Task |
|---------|------|
| 去掉 billboard / 月亮锚点 | 1 |
| 一次摆场 + CITY_CAMERA | 2 |
| 材质撤回钳制、STAR、水面排序、曝光 | 3 |
| bloom/grade（+可选 grain） | 4 |
| 贴图 1024、禁止 join/simplify、文档 | 5 |
| 目视验收 §7 | 6 |
| 水印隐藏、reduced-motion、matte 回退 | 1–3 保留既有路径 |

## Placeholder scan

无 TBD；标定数值需实机写入，Step 已说明调参顺序。
