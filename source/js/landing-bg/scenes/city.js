import * as THREE from 'three'
import { CITY_MODEL_URL } from '../constants.js'
import {
  loadCityBlock
} from '../character/city.js'
import { getScrollTopVelocity } from '../engine/motion.js'
import { setGroupSceneOpacity } from '../engine/scene-blend.js'

/**
 * 来自用户在 Blender 中对齐的活动摄像机（.blend / Z-up）：
 * 位置 (24.004, -27.856, 4.5272)，旋转 XYZ 欧拉 (68.4°, 0°, 90.4°)
 * 已转换到 Three.js Y-up：X→X，Y→Z，Z→-Y
 */
function blenderToThree (x, y, z) {
  return [x, z, -y]
}

const _bPos = [24.004, -27.856, 4.5272]
/** Blender 本地 -Z 视线（XYZ 欧拉换算） */
const _bDir = [-0.929753826455806, -0.0064912172614355525, -0.36812455268462047]
const _bUp = [-0.36811558537426686, -0.002569454051865427, 0.9297764858881065]

const CITY_CAM_POS = blenderToThree(_bPos[0], _bPos[1], _bPos[2])
const CITY_VIEW_DIR = (() => {
  const d = blenderToThree(_bDir[0], _bDir[1], _bDir[2])
  const len = Math.hypot(d[0], d[1], d[2]) || 1
  return [d[0] / len, d[1] / len, d[2] / len]
})()
const CITY_CAM_UP = (() => {
  const u = blenderToThree(_bUp[0], _bUp[1], _bUp[2])
  const len = Math.hypot(u[0], u[1], u[2]) || 1
  return [u[0] / len, u[1] / len, u[2] / len]
})()

/**
 * 城市幕相机微调 —— 只改这 10 个参数。
 *
 * 平移（世界单位，屏幕语义）
 *  1 right    正=右，负=左
 *  2 up       正=上，负=下
 *  3 forward  正=沿视线前进（靠近），负=后退
 *
 * 旋转（度，相对 Blender 基线）
 *  4 yaw      正=往右看，负=往左
 *  5 pitch    正=抬头，负=低头
 *  6 roll     正=屏幕平面逆时针，负=顺时针
 *
 * 注视点相对偏移（世界单位；舞台锚点不动，只改 lookAt）
 *  7 lookRight  正=注视点右偏
 *  8 lookUp     正=注视点上偏
 *
 * 光学
 *  9 focusDist  基线注视距离
 * 10 focalMm    焦距 mm（满幅 24mm 高 → FOV）
 */
export const CITY_CAM_TUNE = {
  right: 1.8,
  up: -7,
  forward: -5.4,
  yaw: -27,
  pitch: 21.5,
  roll: 11,
  lookRight: 7,
  lookUp: 0,
  focusDist: 14,
  focalMm: 21
}

function degToRad (d) {
  return (d * Math.PI) / 180
}

function normalize3 (v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / len, v[1] / len, v[2] / len]
}

function cross3 (a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ]
}

/** 绕单位轴 axis 旋转向量 v（右手系，rad） */
function rotateAxis (v, axis, rad) {
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  const [ax, ay, az] = axis
  const dot = ax * v[0] + ay * v[1] + az * v[2]
  const cx = ay * v[2] - az * v[1]
  const cy = az * v[0] - ax * v[2]
  const cz = ax * v[1] - ay * v[0]
  return [
    v[0] * c + cx * s + ax * dot * (1 - c),
    v[1] * c + cy * s + ay * dot * (1 - c),
    v[2] * c + cz * s + az * dot * (1 - c)
  ]
}

const _camBasis0 = (() => {
  const f = CITY_VIEW_DIR
  let r = normalize3(cross3(f, CITY_CAM_UP))
  const s = normalize3(cross3(r, f))
  r = normalize3(cross3(f, s))
  return { f, r, s }
})()

const _camFramed = (() => {
  const t = CITY_CAM_TUNE
  let f = [..._camBasis0.f]
  let r = [..._camBasis0.r]
  let s = [..._camBasis0.s]

  // yaw：绕屏幕上；pitch：绕右；roll：绕视线
  if (t.yaw) {
    const rad = degToRad(t.yaw)
    f = rotateAxis(f, s, -rad) // 正 yaw = 往右看
    r = rotateAxis(r, s, -rad)
  }
  if (t.pitch) {
    const rad = degToRad(t.pitch)
    f = rotateAxis(f, r, rad) // 正 pitch = 抬头
    s = rotateAxis(s, r, rad)
  }
  f = normalize3(f)
  r = normalize3(cross3(f, s))
  s = normalize3(cross3(r, f))
  if (t.roll) {
    const rad = degToRad(t.roll)
    // 正 roll = 屏幕逆时针 → up = cos*s - sin*r
    s = rotateAxis(s, f, -rad)
    r = rotateAxis(r, f, -rad)
    r = normalize3(r)
    s = normalize3(s)
  }

  const pos = [
    CITY_CAM_POS[0] + r[0] * t.right + s[0] * t.up + f[0] * t.forward,
    CITY_CAM_POS[1] + r[1] * t.right + s[1] * t.up + f[1] * t.forward,
    CITY_CAM_POS[2] + r[2] * t.right + s[2] * t.up + f[2] * t.forward
  ]

  /** 舞台锚点：Blender 基线注视点（不随 yaw/pitch/look 偏移） */
  const stageAnchor = [
    CITY_CAM_POS[0] + CITY_VIEW_DIR[0] * t.focusDist,
    CITY_CAM_POS[1] + CITY_VIEW_DIR[1] * t.focusDist,
    CITY_CAM_POS[2] + CITY_VIEW_DIR[2] * t.focusDist
  ]

  // 注视点 = 沿旋转后视线落点 + 屏幕偏移（舞台仍钉在 stageAnchor）
  const look = [
    pos[0] + f[0] * t.focusDist + r[0] * t.lookRight + s[0] * t.lookUp,
    pos[1] + f[1] * t.focusDist + r[1] * t.lookRight + s[1] * t.lookUp,
    pos[2] + f[2] * t.focusDist + r[2] * t.lookRight + s[2] * t.lookUp
  ]

  return { pos, look, up: s, stageAnchor, focalMm: t.focalMm }
})()

/** 舞台锚点（摆场用，不随观察角偏航移动） */
export const CITY_STAGE_ANCHOR = _camFramed.stageAnchor

export const CITY_LOOK = _camFramed.look

/** 第二幕固定机位（Blender 对齐 + CITY_CAM_TUNE） */
export const CITY_CAMERA = {
  position: _camFramed.pos,
  lookAt: _camFramed.look,
  up: _camFramed.up,
  fov: (2 * Math.atan(24 / (2 * _camFramed.focalMm)) * 180) / Math.PI
}

const BACKDROP_BEHIND = 48
/** 橙柱 glint：放在 look 与相机之间（负=靠近相机），否则会藏在城后 */
const WATER_GLINT_ALONG = -6.5

const LAYOUT = {
  sky: 0.5,
  skyline: 0.67,
  embank: 0.705,
  river: 1
}

function seeded (n) {
  let s = n
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function drawSky (ctx, w, h, phase) {
  const skyH = h * LAYOUT.sky
  const g = ctx.createLinearGradient(0, 0, 0, skyH)
  g.addColorStop(0, '#06050c')
  g.addColorStop(0.45, '#100c18')
  g.addColorStop(1, '#1c1424')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, skyH)

  const rng = seeded(9001)
  for (let i = 0; i < 120; i++) {
    const sx = rng() * w
    const sy = rng() * skyH * 0.92
    const br = 0.15 + rng() * 0.35
    ctx.fillStyle = `rgba(200, 210, 230, ${br})`
    ctx.fillRect(sx, sy, 1 + rng() * 1.5, 1 + rng())
  }

  const mx = w * 0.5
  const my = skyH * 0.42
  const moonR = w * 0.018
  const glow = ctx.createRadialGradient(mx, my, moonR * 0.2, mx, my, moonR * 5)
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.55)')
  glow.addColorStop(0.35, 'rgba(220, 225, 255, 0.12)')
  glow.addColorStop(1, 'rgba(200, 210, 255, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(mx - moonR * 5, my - moonR * 5, moonR * 10, moonR * 10)
  ctx.beginPath()
  ctx.arc(mx, my, moonR, 0, Math.PI * 2)
  ctx.fillStyle = '#f4f6ff'
  ctx.fill()

  const haze = ctx.createLinearGradient(0, skyH * 0.72, 0, skyH)
  haze.addColorStop(0, 'rgba(40, 20, 30, 0)')
  haze.addColorStop(1, 'rgba(80, 30, 40, 0.35)')
  ctx.fillStyle = haze
  ctx.fillRect(0, skyH * 0.55, w, skyH * 0.45)
}

function drawRedFacade (ctx, bx, by, bw, bh, flicker, rng) {
  const f = Number.isFinite(flicker) ? Math.max(0, Math.min(1, flicker)) : 0.5
  const g = ctx.createLinearGradient(bx, by, bx, by + bh)
  g.addColorStop(0, `rgb(${Math.round(215 + f * 20)}, ${Math.round(24 + f * 8)}, 18)`)
  g.addColorStop(0.32, `rgb(255, ${Math.round(68 + f * 10)}, 24)`)
  g.addColorStop(0.58, `rgb(255, ${Math.round(130 + f * 12)}, 48)`)
  g.addColorStop(0.8, `rgb(255, ${Math.round(215 + f * 8)}, 175)`)
  g.addColorStop(1, 'rgb(248, 246, 252)')
  ctx.fillStyle = g
  ctx.fillRect(bx, by, bw, bh)
  const stripeW = Math.max(1.5, bw * 0.07)
  for (let sx = bx + stripeW * 0.35; sx < bx + bw - 1; sx += stripeW * 1.25) {
    ctx.fillStyle = `rgba(255,255,255,${0.03 + rng() * 0.05})`
    ctx.fillRect(sx, by + 2, stripeW * 0.3, bh - 4)
  }
}

function drawSkylineBand (ctx, w, y0, bandH, phase) {
  const rng = seeded(20260526)
  const groundY = y0 + bandH

  const bands = [
    { x: 0.0, w: 0.05, ht: 0.42, kind: 'dark' },
    { x: 0.048, w: 0.045, ht: 0.55, kind: 'stripe' },
    { x: 0.095, w: 0.04, ht: 0.46, kind: 'dark' },
    { x: 0.135, w: 0.048, ht: 0.64, kind: 'red' },
    { x: 0.185, w: 0.038, ht: 0.5, kind: 'dark' },
    { x: 0.225, w: 0.052, ht: 0.72, kind: 'red' },
    { x: 0.278, w: 0.048, ht: 0.6, kind: 'stripe' },
    { x: 0.328, w: 0.105, ht: 0.96, kind: 'chang', char: '长' },
    { x: 0.448, w: 0.105, ht: 0.98, kind: 'chang', char: '沙' },
    { x: 0.562, w: 0.046, ht: 0.7, kind: 'red' },
    { x: 0.612, w: 0.04, ht: 0.56, kind: 'stripe' },
    { x: 0.655, w: 0.036, ht: 0.5, kind: 'dark' },
    { x: 0.692, w: 0.05, ht: 0.8, kind: 'red' },
    { x: 0.745, w: 0.034, ht: 0.48, kind: 'dark' },
    { x: 0.778, w: 0.052, ht: 1.0, kind: 'spire' },
    { x: 0.832, w: 0.038, ht: 0.64, kind: 'dark' },
    { x: 0.872, w: 0.048, ht: 0.74, kind: 'blue' },
    { x: 0.922, w: 0.06, ht: 0.52, kind: 'dark' }
  ]

  for (const b of bands) {
    const bx = b.x * w
    const bw = b.w * w
    const bh = b.ht * bandH * (0.9 + rng() * 0.08)
    const by = groundY - bh
    const flicker = 0.5 + 0.5 * Math.sin(phase * 0.002 + bx * 0.008)

    if (b.kind === 'dark') {
      const t = 6 + Math.floor(rng() * 12)
      ctx.fillStyle = `rgb(${t}, ${t + 2}, ${t + 8})`
      ctx.fillRect(bx, by, bw, bh)
    } else if (b.kind === 'red' || b.kind === 'chang') {
      drawRedFacade(ctx, bx, by, bw, bh, flicker, rng)
      if (b.char) {
        const fontSize = Math.min(bh * 0.5, bw * 0.95)
        ctx.font = `bold ${fontSize}px "YanShiXiaXK", "STKaiti", "KaiTi", "Songti SC", serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = 'rgba(255, 100, 50, 0.5)'
        ctx.shadowBlur = fontSize * 0.08
        ctx.fillStyle = 'rgba(255, 252, 250, 0.98)'
        ctx.fillText(b.char, bx + bw * 0.5, by + bh * 0.36)
        ctx.shadowBlur = 0
      }
    } else if (b.kind === 'stripe') {
      ctx.fillStyle = '#0a0c12'
      ctx.fillRect(bx, by, bw, bh)
      const n = Math.max(3, Math.floor(bw / 4))
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i < n / 2
          ? `rgba(220, 45, 30, ${0.8 + rng() * 0.15})`
          : `rgba(255, 190, 160, ${0.65 + rng() * 0.2})`
        ctx.fillRect(bx + (bw / n) * i, by, bw / n - 0.5, bh)
      }
    } else if (b.kind === 'spire') {
      ctx.fillStyle = '#14161e'
      ctx.fillRect(bx + bw * 0.32, by, bw * 0.36, bh)
      ctx.fillStyle = '#222630'
      ctx.fillRect(bx, by, bw, bh * 0.1)
    } else if (b.kind === 'blue') {
      ctx.fillStyle = '#10141c'
      ctx.fillRect(bx, by + bh * 0.18, bw, bh * 0.82)
      const cap = ctx.createLinearGradient(bx, by, bx, by + bh * 0.2)
      cap.addColorStop(0, '#5a88c0')
      cap.addColorStop(1, '#1a2838')
      ctx.fillStyle = cap
      ctx.fillRect(bx, by, bw, bh * 0.2)
    }
  }
}

function drawEmbankment (ctx, w, y0, h) {
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h)
  g.addColorStop(0, 'rgba(255, 200, 60, 0.95)')
  g.addColorStop(0.5, 'rgba(255, 160, 40, 0.9)')
  g.addColorStop(1, 'rgba(180, 90, 20, 0.7)')
  ctx.fillStyle = g
  ctx.fillRect(0, y0, w, h)
  ctx.fillStyle = 'rgba(255, 230, 150, 0.35)'
  ctx.fillRect(0, y0 - 2, w, 4)
}

function drawRiver (ctx, w, y0, h, phase) {
  ctx.fillStyle = '#030406'
  ctx.fillRect(0, y0, w, h)

  const rng = seeded(4401)
  const cols = 28
  for (let i = 0; i < cols; i++) {
    const cx = (i + 0.5) / cols
    const x = cx * w
    const bw = w * (0.012 + rng() * 0.018)
    const strength = 0.25 + rng() * 0.55
    const sway = Math.sin(phase * 0.0015 + i * 0.7) * w * 0.004

    const rg = ctx.createLinearGradient(x, y0, x, y0 + h)
    rg.addColorStop(0, `rgba(255, 80, 40, ${strength * 0.35})`)
    rg.addColorStop(0.35, `rgba(220, 40, 30, ${strength * 0.65})`)
    rg.addColorStop(0.75, `rgba(120, 20, 15, ${strength * 0.25})`)
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rg
    ctx.fillRect(x + sway - bw * 0.5, y0 + h * 0.02, bw, h * 0.96)
  }

  const gold = ctx.createLinearGradient(0, y0, 0, y0 + h * 0.12)
  gold.addColorStop(0, 'rgba(255, 180, 50, 0.25)')
  gold.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gold
  ctx.fillRect(0, y0, w, h * 0.15)

  for (let i = 0; i < 40; i++) {
    const sx = rng() * w
    const sy = y0 + rng() * h
    ctx.fillStyle = `rgba(255, 255, 255, ${0.02 + rng() * 0.04})`
    ctx.fillRect(sx, sy, 1 + rng() * 2, 1)
  }
}

/** GLB 就位后的远景大气：紫粉夜空 + 暖橙地平，不画假楼/假月/假江（交给资产） */
function drawCityAtmosphere (ctx, w, h) {
  ctx.clearRect(0, 0, w, h)
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#03020a')
  g.addColorStop(0.42, '#0c0818')
  g.addColorStop(0.58, '#241028')
  g.addColorStop(0.68, '#4a2038')
  g.addColorStop(0.76, '#c06030')
  g.addColorStop(0.84, '#2a1014')
  g.addColorStop(1, '#050308')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // 地平暖晕（靠下，勿染上半屏）
  const band = ctx.createRadialGradient(w * 0.52, h * 0.7, w * 0.02, w * 0.52, h * 0.7, w * 0.38)
  band.addColorStop(0, 'rgba(255, 150, 70, 0.42)')
  band.addColorStop(0.4, 'rgba(255, 90, 40, 0.14)')
  band.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = band
  ctx.fillRect(0, h * 0.48, w, h * 0.4)

  const rng = seeded(9001)
  for (let i = 0; i < 70; i++) {
    const sx = rng() * w
    const sy = rng() * h * 0.48
    ctx.fillStyle = `rgba(200, 190, 230, ${0.06 + rng() * 0.18})`
    ctx.fillRect(sx, sy, 1 + rng(), 1)
  }
  applyHorizontalEdgeFade(ctx, w, h, 48)
}

/** 整幅远景：天空 + 对岸楼群 + 江岸 + 江面（比例对齐参考照片） */
function drawCityMatte (ctx, w, h, phase, { skyline = true, atmosphereOnly = false } = {}) {
  if (atmosphereOnly) {
    drawCityAtmosphere(ctx, w, h)
    return
  }
  ctx.clearRect(0, 0, w, h)
  drawSky(ctx, w, h, phase)

  const ySky = h * LAYOUT.sky
  const ySkyline = h * LAYOUT.skyline
  const yEmbank = h * LAYOUT.embank

  if (skyline) {
    drawSkylineBand(ctx, w, ySky, ySkyline - ySky, phase)
  } else {
    // 3D 街区已就位：只留夜空雾气，避免 2D 楼抢戏
    const haze = ctx.createLinearGradient(0, ySky, 0, ySkyline)
    haze.addColorStop(0, 'rgba(20, 12, 24, 0)')
    haze.addColorStop(1, 'rgba(40, 18, 28, 0.45)')
    ctx.fillStyle = haze
    ctx.fillRect(0, ySky, w, ySkyline - ySky)
  }
  drawEmbankment(ctx, w, yEmbank, yEmbank - ySkyline)
  drawRiver(ctx, w, yEmbank, h - yEmbank, phase)
  applyHorizontalEdgeFade(ctx, w, h, 64)
}

/** 预烘焙左右缘透明（避免每帧 getImageData） */
function applyHorizontalEdgeFade (ctx, w, h, fadePx) {
  ctx.save()
  ctx.globalCompositeOperation = 'destination-in'
  const g = ctx.createLinearGradient(0, 0, w, 0)
  const t = fadePx / w
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(t, 'rgba(0,0,0,1)')
  g.addColorStop(1 - t, 'rgba(0,0,0,1)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

const _look = new THREE.Vector3()
const _dir = new THREE.Vector3()

function fitBackdropToCamera (mesh, camera, alongLook = BACKDROP_BEHIND) {
  _look.set(CITY_LOOK[0], CITY_LOOK[1], CITY_LOOK[2])
  _dir.subVectors(_look, camera.position).normalize()
  mesh.position.copy(_look).addScaledVector(_dir, alongLook)
  mesh.quaternion.copy(camera.quaternion)

  const dist = camera.position.distanceTo(mesh.position)
  const vFov = THREE.MathUtils.degToRad(camera.fov)
  const visibleH = 2 * Math.tan(vFov * 0.5) * dist
  const visibleW = visibleH * camera.aspect
  mesh.scale.set(visibleW, visibleH, 1)
}

function createMatteBackdrop () {
  const canvas = document.createElement('canvas')
  canvas.width = 1920
  canvas.height = 1080
  const ctx = canvas.getContext('2d')
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter

  drawCityMatte(ctx, canvas.width, canvas.height, 0)

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: tex,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      transparent: true
    })
  )
  mesh.renderOrder = -10
  mesh.userData.matteCanvas = canvas
  mesh.userData.matteCtx = ctx
  mesh.userData.matteTex = tex
  return mesh
}

/** 近景水面微光（叠在画面下半，增强橙柱反光） */
function createWaterGlint () {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec2 vUv;
      void main() {
        // PlaneGeometry：v=0 在下、v=1 在上；只留屏幕下约 45%
        float waterMask = 1.0 - smoothstep(0.22, 0.48, vUv.y);
        if (waterMask < 0.001) discard;
        float u = vUv.x;
        float ripple = sin(u * 52.0 + time) * 0.5 + 0.5;
        float caustic = sin(u * 24.0 - time * 1.1) * sin(vUv.y * 36.0 + time * 0.85);
        caustic = caustic * 0.5 + 0.5;
        float band = 0.0;
        for (float i = 0.0; i < 5.0; i += 1.0) {
          float cx = 0.18 + i * 0.16;
          band += smoothstep(0.035, 0.0, abs(u - cx)) * 0.38;
        }
        vec3 col = vec3(1.0, 0.45, 0.12) * band * ripple;
        col += vec3(1.0, 0.58, 0.2) * caustic * 0.14;
        float a = (band * ripple * 0.48 + caustic * 0.1) * waterMask;
        gl_FragColor = vec4(col, a);
      }
    `
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
  mesh.renderOrder = 5
  mesh.userData.glintUniforms = mat.uniforms
  mesh.userData.sceneBaseOpacity = 1
  return mesh
}

export function createCityScene () {
  const group = new THREE.Group()

  // 原模型直出：弱中性补光；主氛围交给城市幕暖色 env map
  const ambient = new THREE.AmbientLight(0xffffff, 0.2)
  const hemi = new THREE.HemisphereLight(0xffe0c8, 0x1a1018, 0.4)
  const key = new THREE.DirectionalLight(0xffc090, 0.55)
  key.position.set(25, 35, 40)
  group.add(ambient, hemi, key)

  const backdrop = createMatteBackdrop()
  const waterGlint = createWaterGlint()
  waterGlint.visible = false
  group.add(backdrop, waterGlint)

  /** @type {{ root: THREE.Group, mixer: THREE.AnimationMixer | null } | null} */
  let cityBlock = null
  let matteSkyline = true
  let lastRedraw = 0
  const REDRAW_MS = 320
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  loadCityBlock(CITY_MODEL_URL, CITY_STAGE_ANCHOR, {
    playAnimation: !reducedMotion,
    camera: CITY_CAMERA
  })
    .then((loaded) => {
      cityBlock = loaded
      group.add(loaded.root)
      matteSkyline = false
      backdrop.visible = false
      waterGlint.visible = false
      lastRedraw = 0
      const op = group.userData.sceneOpacity
      if (typeof op === 'number') setGroupSceneOpacity(group, op)
      console.info('[landing-bg] city mounted — raw model (no look grade)', reducedMotion ? 'anim off' : 'anim on')
    })
    .catch((err) => {
      console.warn('[landing-bg] city GLB failed — matte only', err)
    })

  const api = {
    group,
    update (elapsed, delta, camera) {
      if (!camera) return

      if (backdrop.visible) fitBackdropToCamera(backdrop, camera, BACKDROP_BEHIND)
      if (waterGlint.visible) fitBackdropToCamera(waterGlint, camera, WATER_GLINT_ALONG)

      if (cityBlock?.mixer && !reducedMotion) {
        cityBlock.mixer.update((delta || 16) * 0.001)
      }

      // 不再 billboard / lockMoon —— root 保持 prepareStage 后的世界位姿

      const scrollVel = getScrollTopVelocity()
      const t = Number.isFinite(elapsed) ? elapsed : performance.now()
      const vel = Number.isFinite(scrollVel) ? scrollVel : 0
      const phase = t + vel * 2.5 + Math.sin(t * 0.0011) * 120

      if (waterGlint.visible && waterGlint.userData.glintUniforms) {
        waterGlint.userData.glintUniforms.time.value = phase * 0.001
      }

      if (!backdrop.visible || reducedMotion) return
      // atmosphereOnly 静态，不必每帧重绘
      if (!matteSkyline) return
      if (elapsed - lastRedraw < REDRAW_MS) return
      lastRedraw = elapsed

      drawCityMatte(
        backdrop.userData.matteCtx,
        backdrop.userData.matteCanvas.width,
        backdrop.userData.matteCanvas.height,
        phase,
        { skyline: matteSkyline }
      )
      backdrop.userData.matteTex.needsUpdate = true
    },

    onResize () {
      if (!backdrop.visible) return
      const canvas = backdrop.userData.matteCanvas
      const ctx = backdrop.userData.matteCtx
      drawCityMatte(ctx, canvas.width, canvas.height, performance.now(), {
        skyline: matteSkyline
      })
      backdrop.userData.matteTex.needsUpdate = true
      lastRedraw = performance.now()
    }
  }
  return api
}
