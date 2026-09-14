import * as THREE from 'three'
import { getScrollTopVelocity } from '../engine/motion.js'

/** 与 scroll-director LOOK_CITY 一致 */
export const CITY_LOOK = [0, 14, -168]
const BACKDROP_BEHIND = 48

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
  const g = ctx.createLinearGradient(bx, by, bx, by + bh)
  g.addColorStop(0, `rgb(${215 + flicker * 20}, ${24 + flicker * 8}, ${18})`)
  g.addColorStop(0.32, `rgb(255, ${68 + flicker * 10}, ${24})`)
  g.addColorStop(0.58, `rgb(255, ${130 + flicker * 12}, ${48})`)
  g.addColorStop(0.8, `rgb(255, ${215 + flicker * 8}, ${175})`)
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

/** 整幅远景：天空 + 对岸楼群 + 江岸 + 江面（比例对齐参考照片） */
function drawCityMatte (ctx, w, h, phase) {
  ctx.clearRect(0, 0, w, h)
  drawSky(ctx, w, h, phase)

  const ySky = h * LAYOUT.sky
  const ySkyline = h * LAYOUT.skyline
  const yEmbank = h * LAYOUT.embank

  drawSkylineBand(ctx, w, ySky, ySkyline - ySky, phase)
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

function fitBackdropToCamera (mesh, camera) {
  _look.set(CITY_LOOK[0], CITY_LOOK[1], CITY_LOOK[2])
  _dir.subVectors(_look, camera.position).normalize()
  mesh.position.copy(_look).addScaledVector(_dir, BACKDROP_BEHIND)
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
      toneMapped: false
    })
  )
  mesh.renderOrder = -10
  mesh.userData.matteCanvas = canvas
  mesh.userData.matteCtx = ctx
  mesh.userData.matteTex = tex
  return mesh
}

/** 近景水面微光（叠在画面前缘，增强流动感） */
function createWaterGlint () {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
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
        if (vUv.y < 0.52) discard;
        float u = vUv.x;
        float ripple = sin(u * 60.0 + time) * 0.5 + 0.5;
        float caustic = sin(u * 28.0 - time * 1.2) * sin(vUv.y * 40.0 + time * 0.9);
        caustic = caustic * 0.5 + 0.5;
        float band = 0.0;
        for (float i = 0.0; i < 4.0; i += 1.0) {
          float cx = 0.2 + i * 0.18;
          band += smoothstep(0.04, 0.0, abs(u - cx)) * 0.3;
        }
        vec3 col = vec3(1.0, 0.35, 0.15) * band * ripple;
        col += vec3(0.2, 0.55, 0.65) * caustic * 0.08;
        float a = (band * ripple * 0.14 + caustic * 0.04) * smoothstep(0.52, 0.78, vUv.y);
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

  const ambient = new THREE.AmbientLight(0x2a2030, 0.5)
  group.add(ambient)

  const backdrop = createMatteBackdrop()
  const waterGlint = createWaterGlint()
  group.add(backdrop, waterGlint)

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let lastRedraw = 0
  const REDRAW_MS = 320

  const api = {
    group,
    update (elapsed, _delta, camera) {
      if (!camera) return

      fitBackdropToCamera(backdrop, camera)
      fitBackdropToCamera(waterGlint, camera)

      const scrollVel = getScrollTopVelocity()
      const phase =
        elapsed + scrollVel * 2.5 + Math.sin(elapsed * 0.0011) * 120

      if (waterGlint.userData.glintUniforms) {
        waterGlint.userData.glintUniforms.time.value = phase * 0.001
      }

      if (reducedMotion) return
      if (elapsed - lastRedraw < REDRAW_MS) return
      lastRedraw = elapsed

      drawCityMatte(
        backdrop.userData.matteCtx,
        backdrop.userData.matteCanvas.width,
        backdrop.userData.matteCanvas.height,
        phase
      )
      backdrop.userData.matteTex.needsUpdate = true
    },

    onResize () {
      const canvas = backdrop.userData.matteCanvas
      const ctx = backdrop.userData.matteCtx
      drawCityMatte(ctx, canvas.width, canvas.height, performance.now())
      backdrop.userData.matteTex.needsUpdate = true
      lastRedraw = performance.now()
    }
  }
  return api
}
