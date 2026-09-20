# Landing 3D 资产说明

目录：`source/models/landing/`

## 主水母

- 文件：`blue_jellyfish.glb`
- 常量：`JELLYFISH_MODEL_URL`
- 来源：Sketchfab — [Blue jellyfish](https://sketchfab.com/3d-models/blue-jellyfish-c7bd4ef6fed94eb6a303dc4f9486028e) by assetfactory
- 许可：Sketchfab Standard（部署前请核对）
- 控制台成功日志：

```text
[landing-bg] jellyfish GLB: /models/landing/blue_jellyfish.glb code-driven swim (no rig in file)
```

含义：模型已加载；文件内无骨骼动画，由代码驱动游动。这是**正常成功**，不是报错。

## 鱼群

- 当前默认：`fish.glb`（单鱼 + 皮肤 + `ArmatureAction` 游泳，约 291KB）
- 常量：`FISH_MODEL_URL`
- 运行时克隆约 12 条，各用 `AnimationMixer` 错开相位
- 加载失败时回退程序化 Lathe 实例鱼
- **注意**：若导出仍是旧版 `KHR_materials_pbrSpecularGlossiness`，新版 Three.js 会丢贴图变成白金属。本仓库里的 `fish.glb` 已转成 `pbrMetallicRoughness` + `baseColorTexture`。

控制台成功日志：

```text
[landing-bg] fish GLB (skinned): /models/landing/fish.glb clip=ArmatureAction
[landing-bg] animated fish school ready: 12
```

旧静态资源 `shiny_fish.glb` 可保留作备份，不再作为默认 URL。

朝向由 `character/fish.js` 的 `fitAndOrientFishRoot` 自动把最长边转到 +X；若整群侧躺，再改那里的旋转逻辑。

## 城市街区

- 文件：`city.glb`（约 2.6MB，Draco + WebP，`--texture-size 1024`；源文件约 27MB）
- 常量：`CITY_MODEL_URL`
- 类型：**固定机位 2.5D 成片**（对齐 Blender / `CITY_CAMERA`），动画在画面内循环；不是可穿行立体街区，也不是 yaw 长卷主路径
- 加载：`character/city.js` → 一次摆场（`STAGE_*` / `BODY_TARGET_SIZE`）后播动画
- Mac 预览空白正常（不支持 Draco/WebP）；以网页 Three.js 为准
- 缺失时回退 2D matte
- 重压：`node tools/fetch-city-glb.mjs --force`（需 Node ≥18，因 gltf-transform/sharp）

控制台成功日志：

```text
[landing-bg] city stage: /models/landing/city.glb meshes≈… stageScale=… anim=on
[landing-bg] city mounted — fixed stage anim on
```

构图/大小不对时，优先调 `character/city.js` 的 `STAGE_SCALE` / `STAGE_OFFSET` / `STAGE_EULER_YXZ` / `BODY_TARGET_SIZE`，不要再把 yaw 长卷当主调试路径。
机位：`scroll-director.js` 的 `CITY_CAMERA`（及城市幕相关常量）。

验收清晰度（512→1024）需**硬刷新**浏览器缓存后再看霓虹字/水面细节。

许可：Sketchfab 素材（文件名含 please_read_below），部署前请核对作者与许可条款。

## 升级为 VAT 鱼群（可选进阶）

一步到位教程（绑骨 → 烘焙 VAT → 导出目录约定）：

`docs/landing/fish-vat-blender-tutorial.md`

## 检查命令

```bash
pnpm run models:jellyfish
pnpm run models:fish
pnpm run models:city
pnpm run server
```
