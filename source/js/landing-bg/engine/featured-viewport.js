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

/** featured: updateCamera + position.z/y（parallax 默认 0） */
export function applyFeaturedCamera (camera, lookTarget, metrics, parallax = 0, lowInRatio = 0, upInRatio = 1) {
  const ratio = metrics.refTop / metrics.refHeight
  camera.fov = 60
  camera.aspect = metrics.width / metrics.viewportHeight
  const offsetY =
    Math.max(0, -metrics.viewportTop + metrics.paddingTop) +
    (upInRatio - lowInRatio) * metrics.viewportHeight * parallax
  camera.setViewOffset(
    metrics.width,
    metrics.viewportHeight,
    0,
    offsetY,
    metrics.width,
    metrics.height
  )
  camera.position.set(0, ratio * 4.5, 8)
  lookTarget.set(0, 0, 0)
  camera.lookAt(lookTarget)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
}

export function clearFeaturedCamera (camera) {
  camera.clearViewOffset()
}

const _rayOrigin = new THREE.Vector3()
const _rayDir = new THREE.Vector3()
const _planeHit = new THREE.Vector3()
const _mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
const _ray = new THREE.Ray()

/** featured mouseRefToWindow: true + unproject( mouseX, mouseY, 0.5 ) */
export function updateFeaturedMouse (camera, mouse3, elastic, metrics) {
  const w = window.innerWidth || 1
  const h = window.innerHeight || 1
  const mouseX = 2 * ((elastic.x - metrics.left) / w - 0.5)
  const mouseY = 2 * (0.5 - (elastic.y - metrics.top) / h)

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
