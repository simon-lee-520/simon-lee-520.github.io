# 城市幕对齐 Sketchfab「Au Revoir」构图 — 设计说明

**日期：** 2026-09-17  
**状态：** 待实现  
**范围：** Landing 第二幕（city act）实时 GLB 观感  
**非目标：** 与 Sketchfab 截图像素级一致；左右长卷拖拽

---

## 1. 背景与问题

当前 `city.glb`（Sketchfab *Au Revoir* 压缩版）已能加载并播放动画，但与官网成片差距大：

| 官网 | 我们（问题态） |
|------|----------------|
| 橙日低悬、城市剪影、水面+船前景 | 白板月亮、城市被 caustic 水层盖住 |
| 紫粉大气 + 重 bloom / 色散 / grain | 曝光与材质被运行时改坏，后处理偏弱 |
| 作者机位看整场 2.5D 舞台 | 每帧 billboard + 月亮 NDC 锚点，空间关系被重排 |

根因不是「缺模型」，而是 **机位/摆场策略错误**，再叠加材质钳制、贴图 512、后处理差异。

---

## 2. 目标与成功标准

**体验（已确认 A）：** 固定「官网同款一帧」构图；GLB 动画在画面内运动（船、水、飞车）；滚动只负责切幕，不左右拖长卷。

**目视成功标准：**

1. 太阳偏暖橙黄，位于地平线附近（非居中死白板）
2. 城市在太阳前/下方成剪影，霓虹/光柱可辨，不被整片水纹糊住
3. 水面在前景，有反光带；能看到船更佳
4. 滚动城市进度区间内，构图稳定（月亮/太阳不左右跑）
5. 扫一眼能认出是 Au Revoir；不要求与 Sketchfab 像素对齐

**约束：**

- 体积优先：默认 Draco；贴图可升到 1024；目标尽量 ≤ ~5–6MB
- 压缩禁止 `join` / `simplify`（已验证会毁 2.5D 卡片）
- 继续隐藏水印网格（Sketchfab / Blender logo）
- `prefers-reduced-motion`：停动画，静帧构图仍正确

---

## 3. 方案选型

| 方案 | 结论 |
|------|------|
| ① 原位摆场 + 固定 `CITY_CAMERA`，去掉 billboard/月亮锚点 | **采用** |
| ② 继续 billboard，改「整场锚框」 | 否（仍跟症状） |
| ③ 视频/序列帧替代 | 否（体积与衔接差） |

---

## 4. 架构

```
scroll-director          城市进度 → 固定 CITY_CAMERA（pos/look/up/fov）
        │
scenes/city.js           挂载灯光/雾辅助；每帧只 update mixer + 可选轻视差（默认关）
        │
character/city.js        load → 一次 fit（轴向/缩放/平移）→ 播放 AnimationMixer
                         不再 billboard / lockMoon
        │
post/composer.js         城市幕 bloom + grade（暖橙/紫粉）；可选轻 grain/CA
        │
city.glb                 Draco + WebP（贴图 ≤1024），无 join/simplify
```

**数据流（每帧）：**

1. `computeCameraPose(progress)` 在城市区间输出 `CITY_CAMERA`
2. `cityBlock.mixer.update(dt)`（若未 reduced-motion）
3. 不修改 `root` 的朝向/屏幕锚点
4. 后处理按 `cityOpacity` 套用城市 bloom/grade

---

## 5. 组件设计

### 5.1 摆场与相机（`character/city.js` + `scenes/city.js`）

**加载后一次 `prepareStage(content)`：**

- 保持导出轴向（已知 thin≈X 为卡片法线）；**不要**每帧把薄轴拧向相机
- 用排除 rain / sky-dark / wake / 水印 后的 AABB 做一次居中与统一缩放，使主体落入 `CITY_CAMERA` 视锥（以 Blender 对齐的 look 距离为参考，现有 `CITY_FOCUS_DIST ≈ 14`）
- 输出 `root` 固定在世界坐标；`pivot` 仅用于这次静态偏移，之后不再每帧改

**删除 / 停用：**

- `billboardCityStrip` 的每帧调用
- `lockCityMoonAnchor` / `recenterCityBody` 的每帧调用  
  （函数可暂留但城市幕 update 不再调用；实现计划里可删或标 `@deprecated`）

**相机：**

- 沿用 `scenes/city.js` 的 `CITY_CAMERA`（Blender Z-up → Three Y-up 已换算）
- `scroll-director` 城市 key 保持该机位；resize 只更新 `aspect`

**标定流程（实现时）：**

1. 关 billboard/锚点，动画开
2. 用现有 `CITY_CAMERA` 看一帧，对照 Sketchfab 截图调 `content` 的静态 `position/rotation/scale`（优先调模型，少改相机，避免破坏 scroll key）
3. 记录最终常量（如 `STAGE_OFFSET` / `STAGE_SCALE` / 可选 `STAGE_YAW`）

### 5.2 材质与曝光（`tuneCityMaterials` + renderer）

- **撤回** 全局 metalness/roughness 强钳制；仅对明显炸的个别材质做白名单修补
- **`STAR`：** 暖色 albedo + 中高 emissive（橙黄），服务 bloom；避免纯白死板
- **`moon`（小球）：** 保持暗于 STAR，不抢主光
- **水面 / WATERFRONT / caustic：** 检查 `depthWrite` / `transparent` / 渲染顺序，保证城市在后、水在前；必要时降低遮挡城市的大片 opacity
- **水印：** `sketchfab` / `blender_discord` → `visible = false`
- **城市幕曝光：** 在 `cityOpacity` 高时略降 `toneMappingExposure` 或靠 grade 压高光，避免太阳吹穿

### 5.3 后处理（`post/composer.js`）

城市幕（相对现状）：

- bloom：略升 strength，提高 threshold（太阳/霓虹烫，暗部不整屏雾）
- grade：轻微紫粉 + 可选暗角
- 可选：很轻的 grain 与色散（独立开关，默认开但强度低于 Sketchfab）

不做：模仿 Sketchfab 全套查看器特效到 1:1。

### 5.4 资产管道（`tools/fetch-city-glb.mjs`）

- `--texture-size`：**512 → 1024**（若体积超 ~6MB，仅对非关键贴图回退或二次压）
- 仍：`draco` + `webp`；`join/simplify/flatten/instance/palette/weld = false`
- 文档 `docs/landing/models.md` 更新：城市幕为「固定机位成片」，不再写 scroll-strip / yaw 调试为主路径

### 5.5 回退

- GLB 加载失败：继续现有 2D matte
- reduced-motion：静帧 + 固定机位

---

## 6. 错误处理与调试

- 保留简洁 `console.info`：meshes 数、stage scale、clips、相机 fov
- 开发时可临时 `window.__cityDebug = { block, stage }`（勿依赖锚点 NDC）
- 若构图仍偏：优先改 `STAGE_*` 常量，其次微调 `CITY_CAMERA.lookAt` 距离，最后才动 FOV

---

## 7. 验证

1. 桌面宽屏：城市幕进度中段截图 vs Sketchfab 参考（构图/色温/层次）
2. 播动画 10s+：太阳/构图不漂移；船或水面有运动
3. 缩放到手机宽：主体仍在框内（允许裁左右，不裁成「只剩月亮特写」）
4. 关 WebGL / 加载失败：matte 回退正常
5. `prefers-reduced-motion`：无循环动画，构图仍对

---

## 8. 实现顺序（供 plan 拆任务）

1. 去掉每帧 billboard + 月亮锚点；固定 `CITY_CAMERA` 播动画  
2. 标定 `STAGE_*`，对照官网截图调通层次（水/城/日）  
3. 材质与曝光回退/微调（STAR、水面排序）  
4. 城市幕 bloom/grade（+ 可选 grain/CA）  
5. 贴图 1024 重压 + 文档更新  
6. 按 §7 目视验收

---

## 9. 非目标（再次强调）

- 左右长卷无缝循环作为主交互  
- 屏幕空间钉月亮  
- 与 Sketchfab 查看器像素级一致  
- 为城市幕重写整套自定义水面 shader（先用资产内水面纠深度/透明度）
