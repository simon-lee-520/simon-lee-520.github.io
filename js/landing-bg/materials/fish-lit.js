import * as THREE from 'three'
import { FEATURED_CYAN } from './featured-scene.js'
import { applyFeaturedParticleLight } from './featured-particle-lit.js'

/** featured 粒子同色 baseColor（theme[2].pointColor） */
export function createFishBodyMaterial (sharedUniforms) {
  const mat = new THREE.MeshStandardMaterial({
    color: FEATURED_CYAN.pointColor,
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0
  })
  mat.userData.sceneBaseOpacity = 1
  if (sharedUniforms) applyFeaturedParticleLight(mat, sharedUniforms, { brightness: 0 })
  return mat
}

function ensureInstanceColor (body, paths) {
  let maxIdx = 0
  for (const p of paths) maxIdx = Math.max(maxIdx, p.instanceIdx)
  const count = maxIdx + 1
  if (!body.instanceColor || body.instanceColor.count < count) {
    body.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(count * 3),
      3
    )
  }
  return count
}

/** 远暗近略亮（在 featured 光照下微调 instanceColor） */
export function tintFishInstanceColors (body, paths, getDepth01) {
  if (!body || !paths?.length) return
  ensureInstanceColor(body, paths)
  const base = new THREE.Color(FEATURED_CYAN.pointColor)
  const far = base.clone().multiplyScalar(0.35)
  const tmp = new THREE.Color()
  for (const p of paths) {
    const d = getDepth01(p)
    tmp.copy(far).lerp(base, d * 0.75)
    body.setColorAt(p.instanceIdx, tmp)
  }
  body.instanceColor.needsUpdate = true
}

/** GLB 贴图鱼：只用深浅，避免整群被染成青色 */
export function tintFishInstanceColorsTextured (body, paths, getDepth01) {
  if (!body || !paths?.length) return
  ensureInstanceColor(body, paths)
  const near = new THREE.Color(1, 1, 1)
  const far = new THREE.Color(0.4, 0.48, 0.55)
  const tmp = new THREE.Color()
  for (const p of paths) {
    const d = getDepth01(p)
    tmp.copy(far).lerp(near, 0.35 + d * 0.65)
    body.setColorAt(p.instanceIdx, tmp)
  }
  body.instanceColor.needsUpdate = true
}
