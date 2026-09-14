# Landing 3D 资产

## 主水母

当前默认：`blue_jellyfish.glb`（Sketchfab — [Blue jellyfish](https://sketchfab.com/3d-models/blue-jellyfish-c7bd4ef6fed94eb6a303dc4f9486028e) by assetfactory）

```text
source/models/landing/blue_jellyfish.glb
```

站点路径：`/models/landing/blue_jellyfish.glb`

也可使用自定义文件 `jellyfish.glb`，并在 `source/js/landing-bg/constants.js` 中改 `JELLYFISH_MODEL_URL`。

### 许可

Sketchfab 模型使用 **Sketchfab Standard** 许可，部署前请确认个人站点用法符合 [Sketchfab 许可说明](https://sketchfab.com/licenses)。若需无限制商用，请换 CC0 资产或自建模型。

### 模型结构（blue_jellyfish）

- 2 个 mesh：伞盖 `Cylinder` + 触手 `BezierCurve`
- 材质：带 alpha 贴图（`alphaMode: BLEND`）
- 无骨骼动画；站点内用代码驱动伞盖呼吸 + 触手摆动 + 发光脉动（**无需 Blender**）
- 若在 Blender 增加 `idle_pulse` 等 clip，导出后会优先播放文件内动画

朝向：模型主轴沿 **+Z**（伞朝相机、触手向场景深处）。若换模型后方向不对，改 `character/jellyfish.js` 里 `MODEL.rotationX` / `rotationY`。

### 检查

```bash
pnpm run models:jellyfish
pnpm run server
```

滚到海底幕，控制台应出现：

```text
[landing-bg] jellyfish GLB loaded: /models/landing/blue_jellyfish.glb 2 meshes no animation
```

### 自定义 Blender 导出（可选）

1. 朝向：伞盖 +Y 或 +Z（导入后调 `MODEL.rotation*`）
2. 导出 glTF 2.0 Binary，透明用 Alpha Blend
3. mesh 命名含 `bell` / `core` 可自动进 bloom
