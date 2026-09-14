import * as THREE from 'three'

const VEIL_VS = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/** 仅外圈渐隐（地面），中心透明不挡场景 */
const GROUND_FS = `
  uniform vec3 fogColor;
  uniform float opacity;
  varying vec2 vUv;
  void main() {
    float dist = length(vUv - 0.5);
    float a = smoothstep(0.28, 0.5, dist) * opacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(fogColor, a);
  }
`

/** 靠外侧不透明、靠场景中心透明（侧挡板） */
const SIDE_FS = `
  uniform vec3 fogColor;
  uniform float opacity;
  uniform float innerEdge;
  uniform float outerAtLowU;
  varying vec2 vUv;
  void main() {
    float outward = outerAtLowU > 0.5 ? (1.0 - vUv.x) : vUv.x;
    float towardScene = smoothstep(1.0, innerEdge, outward);
    float edgeY = smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
    float a = towardScene * edgeY * opacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(fogColor, a);
  }
`

/** 上下外缘渐隐（天幕） */
const TOP_FS = `
  uniform vec3 fogColor;
  uniform float opacity;
  varying vec2 vUv;
  void main() {
    float edgeX = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
    float edgeY = smoothstep(0.0, 0.35, vUv.y);
    float a = edgeX * edgeY * opacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(fogColor, a);
  }
`

function createVeilMaterial (fragmentShader, opacity = 0.95, extraUniforms = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      fogColor: { value: new THREE.Color(0x060810) },
      opacity: { value: opacity },
      ...extraUniforms
    },
    vertexShader: VEIL_VS,
    fragmentShader
  })
}

function markVeil (mesh) {
  mesh.userData.fogVeil = true
  mesh.userData.noSceneBlend = true
  mesh.renderOrder = 10
  return mesh
}

export function createGroundVeil (y, z, size = 520) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    createVeilMaterial(GROUND_FS, 0.92)
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(0, y, z)
  return markVeil(mesh)
}

export function createSideVeil (x, y, z, rotY, w, h, { innerEdge = 0.42, outerAtLowU = true } = {}) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    createVeilMaterial(SIDE_FS, 0.9, {
      innerEdge: { value: innerEdge },
      outerAtLowU: { value: outerAtLowU ? 1 : 0 }
    })
  )
  mesh.position.set(x, y, z)
  mesh.rotation.y = rotY
  return markVeil(mesh)
}

export function createTopVeil (y, z, w = 520, h = 100) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    createVeilMaterial(TOP_FS, 0.85)
  )
  mesh.position.set(0, y, z)
  mesh.rotation.x = -0.55
  return markVeil(mesh)
}

export function createCityEnclosure () {
  const g = new THREE.Group()
  g.userData.noSceneBlend = true
  const z = -108
  g.add(createGroundVeil(-0.05, z))
  g.add(createSideVeil(-280, 24, -118, Math.PI / 2, 240, 120, { innerEdge: 0.42, outerAtLowU: true }))
  g.add(createSideVeil(280, 24, -118, -Math.PI / 2, 240, 120, { innerEdge: 0.42, outerAtLowU: false }))
  g.add(createTopVeil(95, -95, 640, 90))
  return g
}

export function createOceanEnclosure () {
  const g = new THREE.Group()
  g.userData.noSceneBlend = true
  g.add(createSideVeil(-210, 6, -44, Math.PI / 2, 220, 100, { innerEdge: 0.4, outerAtLowU: true }))
  g.add(createSideVeil(210, 6, -44, -Math.PI / 2, 220, 100, { innerEdge: 0.4, outerAtLowU: false }))
  return g
}

export function updateFogVeils (root, fogColor) {
  root.traverse((obj) => {
    const fog = obj.material?.uniforms?.fogColor
    if (obj.userData.fogVeil && fog) fog.value.copy(fogColor)
  })
}

/** featured 海底幕：关掉各幕 fog veil，避免半透明挡板像玻璃 */
export function setFogVeilsVisible (root, visible) {
  root.traverse((obj) => {
    if (obj.userData.fogVeil) obj.visible = visible
  })
}
