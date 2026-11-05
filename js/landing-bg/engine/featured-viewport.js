import * as THREE from 'three'

/**
 * featured 区块视口度量与相机、鼠标投影
 */
export function computeFeaturedActMetrics (visual, viewportHeight = window.innerHeight) {
  const o = visual.refDomRect
  const paddingTop = visual.paddingTop || 0
  const paddingBottom = visual.paddingBottom || 0
  const padTop = Math.max(0, o.top - paddingTop)
  const padBottom = Math.min(viewportHeight, o.bottom + paddingBottom)
  const left = Math.floor(Math.max(0, o.left))
  const top = Math.floor(padTop)
  const width = o.width
  const height = Math.ceil(padBottom) + (padTop > top ? 1 : 0) - top
  const viewportTop = Math.floor(o.top)
  const viewHeight =
    Math.ceil(o.bottom) + (o.top > viewportTop ? 1 : 0) - viewportTop

  return {
    left,
    top,
    width: Math.max(width, 1),
    height: Math.max(height, 1),
    viewportTop,
    viewportHeight: Math.max(viewHeight, 1),
    paddingTop,
    refTop: o.top,
    refHeight: Math.max(o.height, 1)
  }
}

/** 线上 size 模块：宽 >1280 用 innerHeight，否则减 70（顶栏） */
export function featuredLayoutHeight () {
  const w = window.innerWidth || 1
  const h = window.innerHeight || 1
  return w > 1280 ? h : Math.max(1, h - 70)
}

/**
 * 海底幕取景：对齐安知鱼 featured 的 tall film + viewOffset。
 * fullHeight ≈ 可见高 × 3.53 → 有效竖向 FOV 变「长焦」，
 * 同一世界里的粒子团 + getScatter 体积光占满整窗。
 * 无 #featured 长滚时，offset 取居中裁切（线上 0.2×可见高是滚到区块时的结果）。
 */
export const FEATURED_FULL_HEIGHT_RATIO = 3.53

export function resolveOceanFeaturedMetrics (visual) {
  const base = computeFeaturedActMetrics(visual)
  const viewW = Math.max(window.innerWidth || base.width, 1)
  const viewH = featuredLayoutHeight()
  const fullH = Math.max(1, Math.round(viewH * FEATURED_FULL_HEIGHT_RATIO))
  const offsetY = Math.max(0, Math.round((fullH - viewH) / 2))
  const viewportTop = -offsetY

  return {
    ...base,
    left: 0,
    top: 0,
    width: viewW,
    height: viewH,
    viewportTop,
    viewportHeight: fullH,
    paddingTop: 0,
    refTop: viewportTop,
    refHeight: fullH
  }
}

/** featured: updateCamera + position.z/y（parallax 默认 0）
 * near/far：构造写的是 .1/10，但背景板在 z=-50，far=10 会裁掉整块板，
 * 鼠标处圆形体积光（getScatter）随之消失。取 far=100 罩住背景（线上另有 camera.far=100 赋值）。
 */
export function applyFeaturedCamera (camera, lookTarget, metrics, parallax = 0, lowInRatio = 0, upInRatio = 1) {
  const ratio = metrics.refTop / metrics.refHeight
  // 可见窗用 metrics 宽高（与鼠标 NDC 同一套）；fullH 为 tall film
  const viewW = Math.max(metrics.width, 1)
  const viewH = Math.max(metrics.height, 1)
  const fullH = Math.max(metrics.viewportHeight, 1)
  camera.fov = 60
  camera.near = 0.1
  camera.far = 100
  camera.aspect = viewW / fullH
  const offsetY =
    Math.max(0, -metrics.viewportTop + metrics.paddingTop) +
    (upInRatio - lowInRatio) * fullH * parallax
  camera.setViewOffset(
    viewW,
    fullH,
    0,
    offsetY,
    viewW,
    viewH
  )
  camera.position.set(0, ratio * 4.5, 8)
  lookTarget.set(0, 0, 0)
  camera.lookAt(lookTarget)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
}

export function clearFeaturedCamera (camera, { near = 0.1, far = 2500 } = {}) {
  camera.clearViewOffset()
  camera.near = near
  camera.far = far
  camera.updateProjectionMatrix()
}

const _rayOrigin = new THREE.Vector3()
const _rayDir = new THREE.Vector3()
const _planeHit = new THREE.Vector3()
const _mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
const _ray = new THREE.Ray()

/**
 * 鼠标 → 世界坐标（z=0 平面）。
 * 与安知鱼一致：NDC 相对可见窗（metrics 宽高），再经带 viewOffset 的相机 unproject；
 * tall film 下可见世界更「长焦」，鼠标行程落在吸引半径内。
 */
export function updateFeaturedMouse (
  camera,
  mouse3,
  elastic,
  metrics,
  { refToWindow = false } = {}
) {
  const a = refToWindow
    ? Math.max(window.innerWidth, 1)
    : Math.max(metrics.width, 1)
  const s = refToWindow
    ? Math.max(window.innerHeight, 1)
    : Math.max(metrics.height, 1)
  const left = refToWindow ? 0 : metrics.left
  const top = refToWindow ? 0 : metrics.top
  const mouseX = 2 * ((elastic.x - left) / a - 0.5)
  const mouseY = 2 * (0.5 - (elastic.y - top) / s)

  _rayOrigin.setFromMatrixPosition(camera.matrixWorld)
  _rayDir
    .set(mouseX, mouseY, 0.5)
    .unproject(camera)
    .sub(_rayOrigin)
    .normalize()

  _ray.set(_rayOrigin, _rayDir)
  if (!_ray.intersectPlane(_mousePlane, _planeHit)) return

  const along = _planeHit.distanceTo(_rayOrigin)
  mouse3.copy(_rayOrigin).addScaledVector(_rayDir, along)
}
