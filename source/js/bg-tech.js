/**
 * 赛博朋克科技风 Three.js 背景
 * 天际线城市群 · 多层网格 · 数据流 · 地平霓虹 · 天空渐变
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.172.0/build/three.module.js'

const MOBILE_MQ = window.matchMedia('(max-width: 768px)')
const REDUCE_MOTION_MQ = window.matchMedia('(prefers-reduced-motion: reduce)')

const PALETTE = {
  dark: {
    fog: 0x050810,
    skyTop: new THREE.Color(0x02040a),
    skyMid: new THREE.Color(0x0a0820),
    skyHorizon: new THREE.Color(0x1a0e3a),
    glow: new THREE.Color(0xff2a6d),
    glowAlt: new THREE.Color(0x00e5ff),
    gridMain: 0x0a2a3d,
    gridAccent: 0x00d4ff,
    gridHot: 0xff006e,
    neon: 0x00f5ff,
    neonAlt: 0xff00aa,
    neonWarn: 0xffc400,
    particle: 0x7df9ff,
    window: 0xffeebb,
    windowDim: 0x4488aa
  },
  light: {
    fog: 0xd8e0ea,
    skyTop: new THREE.Color(0xc5d0e0),
    skyMid: new THREE.Color(0xb8c8e8),
    skyHorizon: new THREE.Color(0x9eb8e0),
    glow: new THREE.Color(0x7c4dff),
    glowAlt: new THREE.Color(0x00838f),
    gridMain: 0x90a4ae,
    gridAccent: 0x00838f,
    gridHot: 0x7b1fa2,
    neon: 0x006978,
    neonAlt: 0x5e35b1,
    neonWarn: 0xf57f17,
    particle: 0x455a64,
    window: 0xff8f00,
    windowDim: 0x78909c
  }
}

function getTheme () {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}

function shouldSkip () {
  if (window.__bgTechInited) return true
  if (!document.body.classList.contains('page-landing')) return true
  if (MOBILE_MQ.matches) return true
  return false
}

function maxScroll () {
  return Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
}

function disposeGroup (group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose()
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
      else obj.material.dispose()
    }
  })
}

/* ---------- 天空渐变球 ---------- */
function createSkyDome (colors) {
  const geo = new THREE.SphereGeometry(90, 40, 20)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: colors.skyTop.clone() },
      midColor: { value: colors.skyMid.clone() },
      horizonColor: { value: colors.skyHorizon.clone() },
      glowColor: { value: colors.glow.clone() },
      glowAlt: { value: colors.glowAlt.clone() },
      time: { value: 0 }
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor, midColor, horizonColor, glowColor, glowAlt;
      uniform float time;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld).y * 0.5 + 0.5;
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.45, h));
        col = mix(col, topColor, smoothstep(0.35, 1.0, h));
        float horizon = exp(-abs(normalize(vWorld).y) * 8.0);
        col += glowColor * horizon * 0.35 * (0.85 + 0.15 * sin(time * 0.8));
        col += glowAlt * horizon * 0.2;
        gl_FragColor = vec4(col, 1.0);
      }
    `
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.userData.skyMat = mat
  return mesh
}

/* ---------- 地平光带 ---------- */
function createHorizonGlow (colors) {
  const geo = new THREE.PlaneGeometry(140, 8, 1, 1)
  const mat = new THREE.MeshBasicMaterial({
    color: colors.glow,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(0, -1.2, -42)
  const alt = mesh.clone()
  alt.material = mat.clone()
  alt.material.color = colors.glowAlt
  alt.material.opacity = 0.14
  alt.scale.set(1.2, 1, 1)
  const g = new THREE.Group()
  g.add(mesh, alt)
  g.userData.horizonMats = [mat, alt.material]
  return g
}

/* ---------- 多层透视网格 + 地面热圈 ---------- */
function createGridField (colors) {
  const g = new THREE.Group()
  const layers = [
    { size: 120, div: 60, opacity: 0.5, y: -1.5, z: 0 },
    { size: 120, div: 30, opacity: 0.22, y: -1.48, z: 0 },
    { size: 80, div: 40, opacity: 0.35, y: -1.46, z: -25, hot: true }
  ]
  layers.forEach(({ size, div, opacity, y, z, hot }) => {
    const grid = new THREE.GridHelper(
      size,
      div,
      hot ? colors.gridHot : colors.gridAccent,
      hot ? colors.gridMain : colors.gridMain
    )
    grid.material.transparent = true
    grid.material.opacity = opacity
    grid.position.set(0, y, z)
    g.add(grid)
  })
  // 地面同心霓虹环
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.RingGeometry(4 + i * 6, 4.15 + i * 6, 64)
    const mat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? colors.neon : colors.neonAlt,
      transparent: true,
      opacity: 0.12 - i * 0.015,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    const m = new THREE.Mesh(ring, mat)
    m.rotation.x = -Math.PI / 2
    m.position.y = -1.49
    g.add(m)
  }
  return g
}

/* ---------- 单栋赛博建筑 ---------- */
function createBuilding (colors, x, z, w, d, h, accent) {
  const g = new THREE.Group()
  g.position.set(x, -1.5, z)

  const box = new THREE.BoxGeometry(w, h, d)
  const edges = new THREE.EdgesGeometry(box)
  const edgeMat = new THREE.LineBasicMaterial({
    color: accent ? colors.neonAlt : colors.neon,
    transparent: true,
    opacity: accent ? 0.85 : 0.65
  })
  const wire = new THREE.LineSegments(edges, edgeMat)
  wire.position.y = h / 2
  g.add(wire)

  // 半透明立面（增加体量感）
  const faceMat = new THREE.MeshBasicMaterial({
    color: accent ? colors.neonAlt : colors.neon,
    transparent: true,
    opacity: 0.04,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  const shell = new THREE.Mesh(box, faceMat)
  shell.position.y = h / 2
  g.add(shell)

  // 窗格光点
  const winGeo = new THREE.BufferGeometry()
  const winCount = Math.floor((w + d) * h * 1.2)
  const winPos = new Float32Array(Math.max(winCount, 8) * 3)
  const winPhase = new Float32Array(winPos.length / 3)
  let n = 0
  const cols = Math.max(2, Math.floor(w * 2))
  const rows = Math.max(3, Math.floor(h * 1.5))
  const faces = [
    { axis: 'x', sign: w / 2, u: 'z', v: 'y', w: d, h },
    { axis: 'x', sign: -w / 2, u: 'z', v: 'y', w: d, h },
    { axis: 'z', sign: d / 2, u: 'x', v: 'y', w, h }
  ]
  faces.forEach((face) => {
    for (let r = 0; r < rows && n < winPos.length / 3; r++) {
      for (let c = 0; c < cols && n < winPos.length / 3; c++) {
        if (Math.random() > 0.55) continue
        const u = (c / cols - 0.5) * face.w * 0.85
        const v = (r / rows) * face.h * 0.85 + 0.2
        const p = new THREE.Vector3()
        if (face.axis === 'x') {
          p.x = face.sign
          p.z = u
          p.y = v
        } else {
          p.z = face.sign
          p.x = u
          p.y = v
        }
        winPos[n * 3] = p.x
        winPos[n * 3 + 1] = p.y
        winPos[n * 3 + 2] = p.z
        winPhase[n] = Math.random() * Math.PI * 2
        n++
      }
    }
  })
  winGeo.setAttribute('position', new THREE.BufferAttribute(winPos.subarray(0, n * 3), 3))
  const winMat = new THREE.PointsMaterial({
    color: colors.window,
    size: 0.09,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  })
  const windows = new THREE.Points(winGeo, winMat)
  windows.userData.phases = winPhase.subarray(0, n)
  windows.userData.baseOpacity = 0.75
  g.add(windows)

  // 楼顶天线
  if (h > 4 && Math.random() > 0.4) {
    const pole = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, h, 0),
      new THREE.Vector3(0, h + 1.2 + Math.random(), 0),
      new THREE.Vector3(0.3, h + 0.8, 0)
    ])
    const poleLine = new THREE.Line(
      pole,
      new THREE.LineBasicMaterial({ color: colors.neonWarn, transparent: true, opacity: 0.7 })
    )
    g.add(poleLine)
  }

  g.userData.pulse = { edgeMat, winMat, windows, phase: Math.random() * 6.28 }
  return g
}

function createCityscape (colors) {
  const city = new THREE.Group()
  const rng = (seed) => {
    let s = seed
    return () => {
      s = (s * 16807 + 0) % 2147483647
      return (s - 1) / 2147483646
    }
  }
  const rand = rng(42)
  const slots = []
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 14; col++) {
      if (rand() > 0.78) continue
      const x = (col - 6.5) * 3.2 + (rand() - 0.5) * 1.8
      const z = -6 - row * 5.5 - rand() * 2
      const w = 0.8 + rand() * 2.2
      const d = 0.8 + rand() * 2
      const h = 1.5 + rand() ** 0.55 * 14
      const accent = rand() > 0.72
      slots.push({ x, z, w, d, h, accent })
    }
  }
  slots.forEach((s) => {
    city.add(createBuilding(colors, s.x, s.z, s.w, s.d, s.h, s.accent))
  })
  // 地标高楼（天际线轮廓）
  ;[
    { x: -20, z: -38, w: 2.2, d: 2.2, h: 20, accent: true },
    { x: 4, z: -42, w: 3, d: 2.5, h: 24, accent: false },
    { x: 22, z: -36, w: 2, d: 2, h: 16, accent: true },
    { x: -8, z: -48, w: 2.8, d: 2.8, h: 18, accent: false }
  ].forEach((s) => {
    city.add(createBuilding(colors, s.x, s.z, s.w, s.d, s.h, s.accent))
  })
  city.userData.pulseBuildings = []
  city.traverse((c) => {
    if (c.userData.pulse) city.userData.pulseBuildings.push(c.userData.pulse)
  })
  return city
}

/* ---------- 地面反射（镜像城市剪影） ---------- */
function createCityReflection (city) {
  const reflect = city.clone(true)
  reflect.scale.y = -1
  reflect.position.y = -3.02
  reflect.traverse((obj) => {
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map((m) => {
          const c = m.clone()
          c.opacity *= 0.12
          c.blending = THREE.AdditiveBlending
          return c
        })
      } else if (obj.material.clone) {
        const c = obj.material.clone()
        c.transparent = true
        c.opacity = (c.opacity || 0.5) * 0.15
        c.depthWrite = false
        obj.material = c
      }
    }
  })
  return reflect
}

/* ---------- 数据高速公路（虚线流动） ---------- */
function createDataHighways (colors) {
  const g = new THREE.Group()
  const lines = []
  for (let i = 0; i < 16; i++) {
    const x = (Math.random() - 0.5) * 60
    const z0 = -Math.random() * 50 - 5
    const len = 8 + Math.random() * 20
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, -1.45 + Math.random() * 0.1, z0),
      new THREE.Vector3(x, -1.45, z0 - len)
    ])
    const mat = new THREE.LineDashedMaterial({
      color: Math.random() > 0.5 ? colors.neon : colors.neonAlt,
      transparent: true,
      opacity: 0.45,
      dashSize: 0.8,
      gapSize: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    const line = new THREE.Line(geo, mat)
    line.computeLineDistances()
    line.userData.speed = 0.8 + Math.random() * 1.5
    lines.push({ line, mat })
    g.add(line)
  }
  g.userData.dashLines = lines
  return g
}

/* ---------- 全息广告牌 ---------- */
function createHoloPanels (colors) {
  const g = new THREE.Group()
  const panels = [
    { x: -18, y: 3, z: -20, rw: 4, rh: 2.5 },
    { x: 15, y: 5, z: -28, rw: 3, rh: 2 },
    { x: 6, y: 2.5, z: -12, rw: 2.5, rh: 1.5 }
  ]
  panels.forEach(({ x, y, z, rw, rh }) => {
    const pg = new THREE.Group()
    pg.position.set(x, y, z)
    pg.lookAt(x, y, z + 10)
    const frame = new THREE.PlaneGeometry(rw, rh)
    const edge = new THREE.EdgesGeometry(frame)
    const frameLine = new THREE.LineSegments(
      edge,
      new THREE.LineBasicMaterial({
        color: colors.neon,
        transparent: true,
        opacity: 0.7
      })
    )
    pg.add(frameLine)
    const inner = new THREE.GridHelper(rw, 6, colors.neonAlt, colors.gridMain)
    inner.rotation.x = Math.PI / 2
    inner.material.transparent = true
    inner.material.opacity = 0.25
    inner.scale.set(1, rh / rw, 1)
    pg.add(inner)
    const fill = new THREE.Mesh(
      frame,
      new THREE.MeshBasicMaterial({
        color: colors.neonAlt,
        transparent: true,
        opacity: 0.03,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    )
    pg.add(fill)
    pg.userData.bobPhase = Math.random() * 10
    g.add(pg)
  })
  g.userData.holoPanels = g.children
  return g
}

/* ---------- 垂直光柱 ---------- */
function createLightBeams (colors) {
  const g = new THREE.Group()
  const positions = [
    [-12, -14], [8, -22], [-5, -32], [18, -18], [0, -40]
  ]
  positions.forEach(([x, z], i) => {
    const h = 6 + Math.random() * 8
    const geo = new THREE.PlaneGeometry(0.15, h, 1, 1)
    const mat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? colors.neon : colors.neonAlt,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
    const beam = new THREE.Mesh(geo, mat)
    beam.position.set(x, -1.5 + h / 2, z)
    g.add(beam)
    const beam2 = beam.clone()
    beam2.rotation.y = Math.PI / 2
    beam2.material = mat.clone()
    g.add(beam2)
  })
  return g
}

/* ---------- 粒子：环境尘 + 水平数据流 ---------- */
function createAmbientParticles (colors, count = 500) {
  const positions = new Float32Array(count * 3)
  const speeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 90
    positions[i * 3 + 1] = Math.random() * 18 - 1
    positions[i * 3 + 2] = -Math.random() * 60 - 5
    speeds[i] = 0.01 + Math.random() * 0.025
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.userData.speeds = speeds
  const mat = new THREE.PointsMaterial({
    color: colors.particle,
    size: 0.07,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  })
  return new THREE.Points(geo, mat)
}

function createStreamParticles (colors, count = 280) {
  const positions = new Float32Array(count * 3)
  const velocity = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 70
    positions[i * 3 + 1] = -1.2 + Math.random() * 0.5
    positions[i * 3 + 2] = -Math.random() * 55 - 5
    velocity[i * 3] = 0
    velocity[i * 3 + 1] = 0
    velocity[i * 3 + 2] = -(0.15 + Math.random() * 0.4)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.userData.velocity = velocity
  const mat = new THREE.PointsMaterial({
    color: colors.neon,
    size: 0.05,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  })
  return new THREE.Points(geo, mat)
}

/* ---------- 扫描波（地面缓慢扫过） ---------- */
function createScanWave (colors) {
  const geo = new THREE.PlaneGeometry(100, 2)
  const mat = new THREE.MeshBasicMaterial({
    color: colors.neon,
    transparent: true,
    opacity: 0.06,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = -1.44
  mesh.userData.scanMat = mat
  return mesh
}

function buildWorld (colors) {
  const root = new THREE.Group()
  const sky = createSkyDome(colors)
  const horizon = createHorizonGlow(colors)
  const grid = createGridField(colors)
  const city = createCityscape(colors)
  const reflect = createCityReflection(city)
  const highways = createDataHighways(colors)
  const holo = createHoloPanels(colors)
  const beams = createLightBeams(colors)
  const ambient = createAmbientParticles(colors)
  const streams = createStreamParticles(colors)
  const scan = createScanWave(colors)

  root.add(sky, horizon, grid, city, reflect, highways, holo, beams, ambient, streams, scan)

  return {
    root,
    sky,
    horizon,
    grid,
    city,
    highways,
    holo,
    ambient,
    streams,
    scan
  }
}

function init () {
  if (shouldSkip()) return

  const canvas = document.createElement('canvas')
  canvas.id = 'bg-tech-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.prepend(canvas)

  const scene = new THREE.Scene()
  let theme = getTheme()
  let colors = PALETTE[theme]

  scene.fog = new THREE.FogExp2(colors.fog, 0.028)

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 150)
  camera.position.set(0, 4.2, 16)
  const lookTarget = new THREE.Vector3(0, 1, -22)

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setClearColor(colors.fog, 1)

  let world = buildWorld(colors)
  scene.add(world.root)

  const reduceMotion = REDUCE_MOTION_MQ.matches
  let scrollT = 0
  let scrollTicking = false
  const clock = new THREE.Clock()

  function applyScrollToCamera () {
    const t = scrollT
    camera.position.z = 16 - t * 6
    camera.position.y = 4.2 + t * 1.2
    camera.position.x = Math.sin(t * Math.PI) * 1.2
    lookTarget.y = 0.8 + t * 0.5
    lookTarget.z = -22 - t * 8
    camera.lookAt(lookTarget)
  }

  function updateScroll () {
    scrollT = window.scrollY / maxScroll()
    applyScrollToCamera()
  }

  window.addEventListener(
    'scroll',
    () => {
      if (scrollTicking) return
      scrollTicking = true
      requestAnimationFrame(() => {
        updateScroll()
        scrollTicking = false
      })
    },
    { passive: true }
  )

  function rebuildWorld (nextTheme) {
    theme = nextTheme
    colors = PALETTE[theme]
    scene.fog = new THREE.FogExp2(colors.fog, 0.028)
    renderer.setClearColor(colors.fog, 1)
    disposeGroup(world.root)
    scene.remove(world.root)
    world = buildWorld(colors)
    scene.add(world.root)
  }

  const themeObserver = new MutationObserver(() => {
    const next = getTheme()
    if (next !== theme) rebuildWorld(next)
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  })

  function onResize () {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', onResize)

  function animateWorld (elapsed, delta) {
    if (reduceMotion) return

    const skyMat = world.sky.userData.skyMat
    if (skyMat) skyMat.uniforms.time.value = elapsed

    world.horizon.children.forEach((c, i) => {
      if (c.material) {
        c.material.opacity = (i === 0 ? 0.22 : 0.14) + Math.sin(elapsed * 1.2 + i) * 0.04
      }
    })

    world.city.userData.pulseBuildings.forEach((p) => {
      const flicker = 0.55 + 0.45 * Math.sin(elapsed * 2.5 + p.phase)
      p.edgeMat.opacity = 0.5 + flicker * 0.35
      p.winMat.opacity = p.baseOpacity * (0.4 + 0.6 * Math.sin(elapsed * 3 + p.phase))
    })

    world.highways.userData.dashLines.forEach(({ mat }) => {
      mat.dashOffset -= delta * 2.5
    })

    world.holo.userData.holoPanels.forEach((panel) => {
      panel.position.y += Math.sin(elapsed + panel.userData.bobPhase) * 0.0008
      panel.rotation.z = Math.sin(elapsed * 0.5 + panel.userData.bobPhase) * 0.02
    })

    world.scan.position.z = -5 - ((elapsed * 6) % 50)
    world.scan.userData.scanMat.opacity = 0.04 + Math.sin(elapsed * 3) * 0.02

    world.grid.children.forEach((child, i) => {
      if (child.type === 'GridHelper' && i < 3) {
        child.position.z = ((child.position.z + delta * (0.6 + i * 0.2)) % 2)
      }
    })

    const ap = world.ambient.geometry.attributes.position
    const as = world.ambient.geometry.userData.speeds
    for (let i = 0; i < as.length; i++) {
      let y = ap.getY(i) + as[i] * delta * 60
      if (y > 16) y = -1
      ap.setY(i, y)
    }
    ap.needsUpdate = true

    const sp = world.streams.geometry.attributes.position
    const vel = world.streams.geometry.userData.velocity
    for (let i = 0; i < vel.length / 3; i++) {
      let z = sp.getZ(i) + vel[i * 3 + 2] * delta * 60
      if (z < -58) {
        z = -5
        sp.setX(i, (Math.random() - 0.5) * 70)
      }
      sp.setZ(i, z)
    }
    sp.needsUpdate = true
  }

  function animate () {
    requestAnimationFrame(animate)
    const delta = Math.min(clock.getDelta(), 0.05)
    const elapsed = clock.elapsedTime
    animateWorld(elapsed, delta)
    renderer.render(scene, camera)
  }

  updateScroll()
  animate()

  window.__bgTechInited = true
  window.__bgTechDispose = () => {
    themeObserver.disconnect()
    window.removeEventListener('resize', onResize)
    disposeGroup(world.root)
    renderer.dispose()
    canvas.remove()
    window.__bgTechInited = false
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
