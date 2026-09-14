import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  JELLYFISH_MODEL_URL,
  LAYER_BLOOM,
  OCEAN_CREATURE_Z_CENTER
} from '../constants.js'
import { createJellyfishSilhouette } from '../scenes/ocean-jelly-procedural.js'
import { applyFeaturedParticleToObject } from '../materials/featured-particle-lit.js'

const MODEL = {
  targetHeight: 1.35,
  rotationY: 0,
  rotationX: 0,
  anchorY: 1.15
}

/** 整体压暗贴图，但保留 emissive 自发光 */
const TUNE = {
  colorMul: 0.52,
  opacityMul: 0.78,
  opacityMax: 0.55,
  bellEmissive: 0x3cc8e8,
  tentacleEmissive: 0x2898b8,
  bellEmissiveIntensity: 0.24,
  tentacleEmissiveIntensity: 0.12
}

const GLOW_PULSE = {
  bell: 0.14,
  tentacle: 0.08
}

function loadJellyGltf (url) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        resolve({
          scene: gltf.scene,
          animations: gltf.animations ?? []
        })
      },
      undefined,
      reject
    )
  })
}

function fitJellyModel (root) {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(...box.getSize(new THREE.Vector3()).toArray(), 1e-4)
  const fitScale = MODEL.targetHeight / maxDim
  root.scale.setScalar(fitScale)
  root.userData.fitScale = fitScale
  root.updateMatrixWorld(true)
  box.setFromObject(root)
  box.getCenter(center)
  root.position.x -= center.x
  root.position.z -= center.z
  root.position.y = MODEL.anchorY - (box.min.y + box.max.y) * 0.5
}

function tuneJellyMaterials (root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return
    const isBell = /cylinder|bell|dome|umbrella/i.test(obj.name)
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const mat of mats) {
      if (!mat?.isMeshStandardMaterial && !mat?.isMeshPhysicalMaterial) continue
      mat.envMapIntensity = 0
      if (mat.color) mat.color.multiplyScalar(TUNE.colorMul)
      mat.emissive = new THREE.Color(isBell ? TUNE.bellEmissive : TUNE.tentacleEmissive)
      mat.emissiveIntensity = isBell
        ? TUNE.bellEmissiveIntensity
        : TUNE.tentacleEmissiveIntensity
      const baseOpacity = mat.opacity ?? 1
      mat.opacity = Math.min(baseOpacity * TUNE.opacityMul, TUNE.opacityMax)
      mat.transparent = true
      mat.depthWrite = false
      mat.side = THREE.DoubleSide
      mat.userData.jellyEmissiveBase = mat.emissiveIntensity
      mat.userData.jellyIsBell = isBell
      mat.userData.sceneBaseOpacity = mat.opacity
      if (isBell) obj.layers.enable(LAYER_BLOOM)
    }
  })
}

/** 动画挂在 Cylinder.001 / BezierCurve.001 父节点（比 leaf mesh 更明显） */
function collectGltfParts (model) {
  const parts = {
    bell: null,
    tentacles: null,
    bellMesh: null,
    tentacleMesh: null,
    materials: []
  }

  model.traverse((obj) => {
    if (obj.name === 'Cylinder.001') parts.bell = obj
    if (obj.name === 'BezierCurve.001') parts.tentacles = obj
    if (!obj.isMesh) return

    const isBell = /cylinder|bell|dome|umbrella/i.test(obj.name)
    const isTentacle = /bezier|curve|tentacle|strand/i.test(obj.name)
    if (isBell) parts.bellMesh = obj
    if (isTentacle) parts.tentacleMesh = obj

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const mat of mats) {
      if (mat) parts.materials.push({ mat, isBell })
    }
  })

  if (!parts.bell && parts.bellMesh) {
    parts.bell = parts.bellMesh.parent?.name?.includes('Cylinder')
      ? parts.bellMesh.parent
      : parts.bellMesh
  }
  if (!parts.tentacles && parts.tentacleMesh) {
    parts.tentacles = parts.tentacleMesh.parent?.name?.includes('Bezier')
      ? parts.tentacleMesh.parent
      : parts.tentacleMesh
  }

  return parts
}

function updateGltfGlow (parts, pulse) {
  if (!parts?.materials?.length) return
  const glow = Math.max(0, pulse)
  for (const { mat, isBell } of parts.materials) {
    const base = mat.userData.jellyEmissiveBase ?? (isBell ? TUNE.bellEmissiveIntensity : TUNE.tentacleEmissiveIntensity)
    const amp = isBell ? GLOW_PULSE.bell : GLOW_PULSE.tentacle
    mat.emissiveIntensity = base + glow * amp
  }
}

/**
 * GLB 无骨骼动画时的程序化游动（无需 Blender）
 * - 整体呼吸 scale
 * - 伞盖父节点 Z 轴胀缩
 * - 触手父节点摆动
 */
export function updateGltfJellyfishMotion (group, tSec, phase, pulse) {
  const parts = group.userData.gltfParts
  const model = group.userData.modelRoot
  if (!parts || !model) return

  const fitScale = model.userData.fitScale ?? 1
  const bodyBreathe = 1 + pulse * 0.035
  model.scale.setScalar(fitScale * bodyBreathe)

  if (parts.bell) {
    parts.bell.scale.set(
      1 - pulse * 0.08,
      1 - pulse * 0.08,
      1 + pulse * 0.14
    )
    parts.bell.rotation.z = Math.sin(tSec * 0.9 + phase) * 0.04
  }

  if (parts.tentacles) {
    const lag = tSec * 0.55 + phase - 0.45
    parts.tentacles.rotation.set(
      Math.sin(lag) * 0.32,
      Math.sin(lag * 0.82 + 0.6) * 0.38,
      Math.sin(lag * 1.05) * 0.12
    )
    parts.tentacles.position.z = Math.sin(tSec * 0.7 + phase - 0.5) * 0.06
  }

  updateGltfGlow(parts, pulse)
}

function pickIdleClip (animations) {
  const names = ['idle_pulse', 'idle', 'swim_idle', 'float']
  for (const n of names) {
    const clip = animations.find((c) => c.name === n || c.name.toLowerCase().includes(n))
    if (clip) return clip
  }
  return animations[0] ?? null
}

export function createMainJellyfish (sharedUniforms) {
  const group = new THREE.Group()
  group.name = 'MainJellyfish'
  group.userData.sharedUniforms = sharedUniforms

  const fallback = createJellyfishSilhouette(true, 0)
  fallback.name = 'JellyProceduralFallback'
  group.add(fallback)

  group.userData.isMain = true
  group.userData.isGltf = false
  group.userData.baseScale = fallback.userData.baseScale
  group.userData.phase = fallback.userData.phase
  group.userData.planeZ = OCEAN_CREATURE_Z_CENTER
  group.userData.driftN = { ...fallback.userData.driftN }
  group.userData.tentacleStrands = fallback.userData.tentacleStrands
  group.userData.gltfParts = null
  group.userData.mixer = null
  group.userData.modelRoot = null

  loadJellyGltf(JELLYFISH_MODEL_URL)
    .then(({ scene, animations }) => {
      const model = scene
      model.name = 'JellyfishGltf'
      model.rotation.set(MODEL.rotationX, MODEL.rotationY, 0)
      tuneJellyMaterials(model)
      if (group.userData.sharedUniforms) {
        applyFeaturedParticleToObject(model, group.userData.sharedUniforms)
      }
      fitJellyModel(model)

      fallback.visible = false
      group.add(model)

      group.userData.gltfParts = collectGltfParts(model)
      group.userData.modelRoot = model
      group.userData.isGltf = true
      group.userData.tentacleStrands = null

      const clip = pickIdleClip(animations)
      if (clip) {
        const mixer = new THREE.AnimationMixer(model)
        mixer.clipAction(clip).play()
        group.userData.mixer = mixer
      }

      console.info(
        '[landing-bg] jellyfish GLB:',
        JELLYFISH_MODEL_URL,
        clip?.name ?? 'code-driven swim (no rig in file)'
      )
    })
    .catch((err) => {
      console.warn('[landing-bg] jellyfish GLB failed — procedural fallback', err)
    })

  return group
}
