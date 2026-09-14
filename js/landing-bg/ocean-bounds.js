import * as THREE from 'three'
import { OCEAN_CREATURE_Z_CENTER } from './constants.js'

const NDC_CORNERS = [
  new THREE.Vector2(-1, -1),
  new THREE.Vector2(1, -1),
  new THREE.Vector2(1, 1),
  new THREE.Vector2(-1, 1)
]
const raycaster = new THREE.Raycaster()
const hit = new THREE.Vector3()
const plane = new THREE.Plane()

/** 海底幕固定机位下的保守回退范围 */
const FALLBACK_BOUNDS = {
  xMin: -30,
  xMax: 30,
  yMin: -7.5,
  yMax: 10
}

let currentBounds = { ...FALLBACK_BOUNDS }

export function getOceanXYBounds () {
  return currentBounds
}

function boundsOnPlane (camera, planeZ, padding) {
  plane.setFromNormalAndCoplanarPoint(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, planeZ)
  )
  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  let hits = 0

  for (const ndc of NDC_CORNERS) {
    raycaster.setFromCamera(ndc, camera)
    if (!raycaster.ray.intersectPlane(plane, hit)) continue
    hits++
    xMin = Math.min(xMin, hit.x)
    xMax = Math.max(xMax, hit.x)
    yMin = Math.min(yMin, hit.y)
    yMax = Math.max(yMax, hit.y)
  }
  if (hits < 4) return null

  const cx = (xMin + xMax) * 0.5
  const cy = (yMin + yMax) * 0.5
  const hx = (xMax - xMin) * 0.5 * padding
  const hy = (yMax - yMin) * 0.5 * padding
  return { xMin: cx - hx, xMax: cx + hx, yMin: cy - hy, yMax: cy + hy }
}

function mergeBounds (a, b) {
  return {
    xMin: Math.min(a.xMin, b.xMin),
    xMax: Math.max(a.xMax, b.xMax),
    yMin: Math.min(a.yMin, b.yMin),
    yMax: Math.max(a.yMax, b.yMax)
  }
}

/** 按当前相机与视口更新可交互/生物活动 XY 范围 */
export function updateOceanXYBounds (camera) {
  const near = boundsOnPlane(camera, OCEAN_CREATURE_Z_CENTER, 0.98)
  const far = boundsOnPlane(camera, -36, 0.98)
  if (near && far) currentBounds = mergeBounds(near, far)
  else if (near) currentBounds = near
  else if (far) currentBounds = far
  return currentBounds
}

export function clampOceanXY (x, y) {
  const b = currentBounds
  return {
    x: THREE.MathUtils.clamp(x, b.xMin, b.xMax),
    y: THREE.MathUtils.clamp(y, b.yMin, b.yMax)
  }
}

export function lerpOceanX (t) {
  const b = currentBounds
  return THREE.MathUtils.lerp(b.xMin, b.xMax, t)
}

export function lerpOceanY (t) {
  const b = currentBounds
  return THREE.MathUtils.lerp(b.yMin, b.yMax, t)
}

export function oceanSpan () {
  const b = currentBounds
  return {
    width: b.xMax - b.xMin,
    height: b.yMax - b.yMin,
    cx: (b.xMin + b.xMax) * 0.5,
    cy: (b.yMin + b.yMax) * 0.5
  }
}
