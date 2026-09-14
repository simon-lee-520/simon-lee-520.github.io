import {
  BOUNDARY_12_VH,
  BOUNDARY_23_VH,
  BLEND_HALF_VH,
  TOTAL_VH,
  OCEAN_INTERACTIVE_BLEND
} from './constants.js'
import { CITY_LOOK } from './scenes/city.js'

function smoothstep (t) {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

/** 与 #landing 的 510vh 布局对齐（200+160+150），避免页脚/内容撑高导致 progress 回跳 */
export function getDesignMaxScroll () {
  const vhPx = window.innerHeight / 100
  return Math.max(TOTAL_VH * vhPx - window.innerHeight, 1)
}

function computeBlendVh (scrollVh, centerVh) {
  const lo = centerVh - BLEND_HALF_VH
  const hi = centerVh + BLEND_HALF_VH
  if (scrollVh <= lo) return 0
  if (scrollVh >= hi) return 1
  return smoothstep((scrollVh - lo) / (hi - lo))
}

export function computeScrollState (scrollY) {
  const vhPx = window.innerHeight / 100
  const scrollVh = scrollY / vhPx
  const maxScroll = getDesignMaxScroll()
  const progress = maxScroll <= 0 ? 0 : Math.max(0, Math.min(1, scrollY / maxScroll))
  const blend12 = computeBlendVh(scrollVh, BOUNDARY_12_VH)
  const blend23 = computeBlendVh(scrollVh, BOUNDARY_23_VH)

  let actIndex = 1
  if (scrollVh >= BOUNDARY_23_VH) actIndex = 3
  else if (scrollVh >= BOUNDARY_12_VH) actIndex = 2

  return {
    progress,
    scrollVh,
    blend12,
    blend23,
    actIndex,
    oceanInteractive: blend23 >= OCEAN_INTERACTIVE_BLEND
  }
}

/** 剑客注视点（与 space.js 中 swordsman.group 位置对齐） */
const LOOK_SWORD = [0, 2.2, -8]
/** 城市夜景：隔江平视，注视对岸地平线（与 city.js CITY_LOOK 同步） */
const LOOK_CITY = CITY_LOOK
/** 45° 斜向俯视；幕 2 城市段固定正视（azimuth = 0），滚动时不绕 Y 轴转镜头 */
const OBLIQUE_ELEV = Math.PI / 4
/** 城市段低仰角 ≈ 隔江远眺，非俯冲到楼顶 */
const CITY_OBLIQUE_ELEV = 0.13
const CAM_DIST_SWORD = 16
const CAM_DIST_CITY = 98

function obliqueCameraKey (p, azimuth, distance, look, fov, elev = OBLIQUE_ELEV) {
  const horiz = distance * Math.cos(elev)
  const elevOff = distance * Math.sin(elev)
  const [lx, ly, lz] = look
  return {
    p,
    pos: [
      lx + horiz * Math.sin(azimuth),
      ly + elevOff,
      lz + horiz * Math.cos(azimuth)
    ],
    look: [...look],
    fov
  }
}

/** 城市段全程共用机位：正视 + 远景，滚动时不改变视角 */
const CITY_CAMERA_KEY = obliqueCameraKey(0.43, 0, CAM_DIST_CITY, LOOK_CITY, 52, CITY_OBLIQUE_ELEV)

/** 海底段：固定正视（沿 -Z 平视），进入混合区后滚动不再改机位 */
const LOOK_OCEAN = [0, 1.15, -30]
const OCEAN_CAMERA = {
  position: [0, 1.15, -8],
  lookAt: [...LOOK_OCEAN],
  fov: 50
}

const CAMERA_KEYS = [
  obliqueCameraKey(0.0, 0, CAM_DIST_SWORD, LOOK_SWORD, 58),
  obliqueCameraKey(0.32, Math.PI * 0.5, CAM_DIST_SWORD, LOOK_SWORD, 56),
  { ...CITY_CAMERA_KEY, p: 0.43 },
  { ...CITY_CAMERA_KEY, p: 0.72 }
]

function lerp (a, b, t) { return a + (b - a) * t }

export function computeCameraPose (progress, scrollVh) {
  const oceanBlendStartVh = BOUNDARY_23_VH - BLEND_HALF_VH
  if (scrollVh >= oceanBlendStartVh) {
    return {
      position: [...OCEAN_CAMERA.position],
      lookAt: [...OCEAN_CAMERA.lookAt],
      fov: OCEAN_CAMERA.fov
    }
  }

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
