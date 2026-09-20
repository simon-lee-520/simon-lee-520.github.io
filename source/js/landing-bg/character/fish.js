import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import { FISH_MODEL_URL } from '../constants.js'
import { applyFeaturedParticleLight } from '../materials/featured-particle-lit.js'

/** 归一化后鱼体最长边 */
const TARGET_LENGTH = 0.85

/** Blender 勾选 Draco 导出时必须挂 DRACOLoader */
let sharedDracoLoader = null

function getDracoLoader () {
  if (!sharedDracoLoader) {
    sharedDracoLoader = new DRACOLoader()
    sharedDracoLoader.setDecoderPath(
      'https://www.gstatic.com/draco/versioned/decoders/1.5.7/'
    )
  }
  return sharedDracoLoader
}

function loadFishGltf (url) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.setDRACOLoader(getDracoLoader())
    loader.load(url, resolve, undefined, reject)
  })
}

function tuneFishMaterials (root, sharedUniforms) {
  root.traverse((obj) => {
    if (!obj.isMesh) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const mat of mats) {
      if (!mat) continue
      // 旧 specular-glossiness GLB 在新 Three 里会丢贴图 → 白金属；强制非金属 + 保留 map
      if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
        if (mat.metalness > 0.2) mat.metalness = 0
        if (mat.roughness < 0.35) mat.roughness = 0.55
        if (mat.map) {
          mat.map.colorSpace = THREE.SRGBColorSpace
          mat.map.needsUpdate = true
        } else {
          console.warn(
            '[landing-bg] fish material has no diffuse map — expect washed / white look'
          )
        }
      }
      mat.envMapIntensity = 0
      mat.userData.sceneBaseOpacity = mat.opacity ?? 1
      if (sharedUniforms && !mat.userData.featuredParticleLitV1) {
        // brightness 略低，避免手电筒 scatter 把蓝贴图洗成白
        applyFeaturedParticleLight(mat, sharedUniforms, { brightness: 0.04 })
      }
    }
  })
}

/**
 * 鼻尖 → 局部 +X，肚皮大致 +Y；缩放至 TARGET_LENGTH
 * （对整棵 glTF 根节点操作，保留皮肤动画）
 */
function fitAndOrientFishRoot (root) {
  root.updateMatrixWorld(true)
  let box = new THREE.Box3().setFromObject(root)
  let size = box.getSize(new THREE.Vector3())

  if (size.z >= size.x && size.z >= size.y) {
    root.rotation.y = -Math.PI / 2
  } else if (size.y >= size.x && size.y >= size.z) {
    root.rotation.z = -Math.PI / 2
  }

  root.updateMatrixWorld(true)
  box = new THREE.Box3().setFromObject(root)
  const center = box.getCenter(new THREE.Vector3())
  root.position.x -= center.x
  root.position.y -= center.y
  root.position.z -= center.z

  root.updateMatrixWorld(true)
  box = new THREE.Box3().setFromObject(root)
  size = box.getSize(new THREE.Vector3())
  const longest = Math.max(size.x, size.y, size.z, 1e-4)
  root.scale.multiplyScalar(TARGET_LENGTH / longest)

  root.updateMatrixWorld(true)
  box = new THREE.Box3().setFromObject(root)
  const c2 = box.getCenter(new THREE.Vector3())
  root.position.x -= c2.x
  root.position.y -= c2.y
  root.position.z -= c2.z
}

function pickSwimClip (animations) {
  if (!animations?.length) return null
  const prefer = [/swim/i, /armature/i, /action/i, /idle/i]
  for (const re of prefer) {
    const hit = animations.find((c) => re.test(c.name))
    if (hit) return hit
  }
  return animations[0]
}

/**
 * 加载带动画的鱼模板（只加载一次，再 SkeletonUtils.clone）
 * @returns {Promise<{ template: THREE.Object3D, animations: THREE.AnimationClip[] }>}
 */
export async function loadAnimatedFishTemplate (url = FISH_MODEL_URL, sharedUniforms) {
  const gltf = await loadFishGltf(url)
  const template = gltf.scene
  tuneFishMaterials(template, sharedUniforms)
  fitAndOrientFishRoot(template)

  const clip = pickSwimClip(gltf.animations)
  console.info(
    '[landing-bg] fish GLB (skinned):',
    url,
    clip ? `clip=${clip.name}` : 'no animation'
  )

  return {
    template,
    animations: gltf.animations ?? []
  }
}

/**
 * 从模板克隆一条可独立播放游泳动画的鱼
 * @returns {{ root: THREE.Group, mixer: THREE.AnimationMixer }}
 */
export function spawnAnimatedFish (template, animations) {
  const root = new THREE.Group()
  root.name = 'AnimatedFish'
  const model = cloneSkinned(template)
  root.add(model)

  const mixer = new THREE.AnimationMixer(model)
  const clip = pickSwimClip(animations)
  if (clip) {
    const action = mixer.clipAction(clip)
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.play()
    action.timeScale = 0.75 + Math.random() * 0.7
    action.time = Math.random() * Math.max(clip.duration, 0.01)
  }

  return { root, mixer }
}

/** @deprecated 静态 InstancedMesh 路径仍可能引用；带动画后 ocean 不再调用 */
export function updateFishSwimTime () {}

export async function loadFishPrototype () {
  throw new Error('use loadAnimatedFishTemplate + spawnAnimatedFish')
}
