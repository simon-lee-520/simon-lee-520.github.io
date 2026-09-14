import * as THREE from 'three'
import { PALETTE } from '../constants.js'
import { createSwordsman } from '../character/swordsman.js'
import { createGroundVeil } from './enclosure.js'

const STAR_COUNT = 2400
const STAR_RADIUS = 95
/** 幕 1 由相机轨道转侧面，场景不再沿 Z 漂移造成「靠近」感 */
const DRIFT_Z_PER_MS = 0

function createSkyDome () {
  const geo = new THREE.SphereGeometry(200, 48, 32)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x010204) },
      midColor: { value: new THREE.Color(0x060810) },
      horizonColor: { value: new THREE.Color(0x10141c) },
      glowCyan: { value: new THREE.Color(0x1a2838) },
      glowMagenta: { value: new THREE.Color(0x181420) },
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
      uniform vec3 topColor, midColor, horizonColor, glowCyan, glowMagenta;
      uniform float time;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld).y * 0.5 + 0.5;
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.5, h));
        col = mix(col, topColor, smoothstep(0.4, 1.0, h));
        float band = exp(-abs(h - 0.2) * 11.0);
        col += glowMagenta * band * (0.06 + 0.03 * sin(time * 0.5));
        col += glowCyan * exp(-abs(h - 0.06) * 16.0) * 0.08;
        col = pow(col, vec3(1.12));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  })
  const sky = new THREE.Mesh(geo, mat)
  sky.userData.noSceneBlend = true
  sky.userData.skyUniforms = mat.uniforms
  return sky
}

function createStarfield () {
  const positions = new Float32Array(STAR_COUNT * 3)
  const colors = new Float32Array(STAR_COUNT * 3)
  const phases = new Float32Array(STAR_COUNT)
  const cWarm = new THREE.Color(PALETTE.starWarm)
  const cCool = new THREE.Color(PALETTE.starCool)
  const cDim = new THREE.Color(0x6a7080)
  const tmp = new THREE.Color()

  for (let i = 0; i < STAR_COUNT; i++) {
    const u = Math.random()
    const v = Math.random()
    const theta = 2 * Math.PI * u
    const phi = Math.acos(2 * v - 1)
    const r = STAR_RADIUS * (0.75 + Math.random() * 0.25)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)
    phases[i] = Math.random() * Math.PI * 2

    const pick = Math.random()
    if (pick < 0.04) tmp.copy(cDim)
    else if (pick < 0.55) tmp.copy(cCool)
    else tmp.copy(cWarm)
    const bright = 0.28 + Math.random() * 0.42
    colors[i * 3] = tmp.r * bright
    colors[i * 3 + 1] = tmp.g * bright
    colors[i * 3 + 2] = tmp.b * bright
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1))

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 65 * (window.devicePixelRatio > 1 ? 0.85 : 1) }
    },
    vertexShader: `
      attribute vec3 color;
      attribute float phase;
      uniform float uTime;
      uniform float uSize;
      varying vec3 vColor;
      varying float vDist;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDist = -mv.z;
        float twinkle = 0.72 + 0.28 * sin(uTime * 1.4 + phase);
        gl_PointSize = uSize * twinkle * (280.0 / max(vDist, 1.0));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vDist;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.0, d);
        float fade = smoothstep(120.0, 20.0, vDist);
        gl_FragColor = vec4(vColor * core, core * fade * 0.85);
      }
    `
  })

  const stars = new THREE.Points(geometry, material)
  stars.userData.noSceneBlend = true
  stars.userData.starUniforms = material.uniforms
  return stars
}

function createNebulaLayer (color, w, h, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.14,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  )
  mesh.position.set(x, y, z)
  mesh.rotation.y = Math.random() * Math.PI * 2
  mesh.rotation.z = (Math.random() - 0.5) * 0.35
  mesh.userData.noSceneBlend = true
  return mesh
}

function createNebulae () {
  const g = new THREE.Group()
  g.add(createNebulaLayer(0x121828, 55, 28, -25, 8, -55))
  g.add(createNebulaLayer(0x0c1420, 42, 22, 30, 12, -50))
  g.add(createNebulaLayer(0x101018, 38, 18, 6, 18, -60))
  return g
}

function createMeteor () {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-2.8, 0.5, 0, 0, 0, 0], 3)
  )
  const meteor = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0x7a8494,
      transparent: true,
      opacity: 0.38,
      blending: THREE.NormalBlending,
      depthWrite: false
    })
  )
  meteor.userData.velocity = new THREE.Vector3()
  return meteor
}

function spawnMeteor (meteor) {
  meteor.position.set(
    (Math.random() - 0.5) * 55,
    20 + Math.random() * 28,
    -55 - Math.random() * 35
  )
  meteor.userData.velocity.set(
    0.02 + Math.random() * 0.03,
    -0.04 - Math.random() * 0.025,
    0.08 + Math.random() * 0.05
  )
}

function updateMeteor (meteor, dt) {
  meteor.position.addScaledVector(meteor.userData.velocity, dt)
  if (meteor.position.y < -8 || meteor.position.z > 25) spawnMeteor(meteor)
}

export function createSpaceScene () {
  const group = new THREE.Group()

  const ambient = new THREE.AmbientLight(0x1a2030, 0.22)
  const key = new THREE.DirectionalLight(0x7080a0, 0.28)
  key.position.set(4, 14, 10)
  const fill = new THREE.DirectionalLight(0x304058, 0.12)
  fill.position.set(-6, 4, -8)
  const swordGlow = new THREE.PointLight(0x4a7090, 0.55, 16)
  swordGlow.position.set(0, 2.2, -5)
  group.add(ambient, key, fill, swordGlow)

  const sky = createSkyDome()
  const stars = createStarfield()
  group.add(sky)
  group.add(createGroundVeil(-3, 0, 420))
  group.add(stars)
  group.add(createNebulae())

  const swordsman = createSwordsman()
  swordsman.group.position.set(0, 1.85, -8)
  group.add(swordsman.group)

  const meteors = []
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (let i = 0; i < 4; i++) {
      const meteor = createMeteor()
      spawnMeteor(meteor)
      group.add(meteor)
      meteors.push(meteor)
    }
  }

  let lastElapsed = 0

  return {
    group,
    swordsman,
    update (state, elapsed) {
      const dt = lastElapsed ? elapsed - lastElapsed : 16
      lastElapsed = elapsed

      group.position.z += DRIFT_Z_PER_MS * dt

      if (sky.userData.skyUniforms) {
        sky.userData.skyUniforms.time.value = elapsed * 0.001
      }
      if (stars.userData.starUniforms) {
        stars.userData.starUniforms.uTime.value = elapsed * 0.001
      }

      group.traverse((obj) => {
        if (obj.userData?.noSceneBlend && obj.material?.opacity !== undefined && obj.geometry?.type === 'PlaneGeometry') {
          obj.material.opacity = 0.1 + 0.04 * Math.sin(elapsed * 0.0006 + obj.position.x * 0.1)
        }
      })

      const blend12 = state?.blend12 ?? 0
      swordsman.updateFly(elapsed, dt * 0.001)
      swordsman.updateExit(blend12)

      for (const meteor of meteors) {
        updateMeteor(meteor, dt)
      }
    }
  }
}
