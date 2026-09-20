import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { CITY_MODEL_URL } from '../constants.js'

/**
 * Au Revoir 2.5D：一次摆场对齐 CITY_CAMERA。
 * 构图：AABB（排除水面）居中缩放 → STAR 钉 pivot → root 按「屏幕轴」偏移。
 * STAGE_OFFSET = [screenRight, screenUp, depthAlongLook]
 * 官网目标：太阳略偏中上偏右，天际线约中线，水面占下约 1/3。
 */
const STAGE_SCALE = 1
/** 屏幕空间微调：[右, 上, 沿视线深度] — 对齐官网：日略偏右上、天际线中段 */
const STAGE_OFFSET = [0.6, 6.0, 0]
const STAGE_EULER_YXZ = [0, 0, 0]
const BODY_TARGET_SIZE = 290

const DEFAULT_LOOK = [0, 0, 0]
/** 摆场测量时排除的噪声层（不影响显示；显示层见 tuneCityMaterials 原样） */
const IGNORE_MAT = /rain|sky-?dark|wake|sketchfab|blender_discord/i

const _size = new THREE.Vector3()
const _center = new THREE.Vector3()
const _box = new THREE.Box3()
const _meshBox = new THREE.Box3()
const _com = new THREE.Vector3()
const _starWorld = new THREE.Vector3()
const _starLocal = new THREE.Vector3()
const _camPos = new THREE.Vector3()
const _look = new THREE.Vector3()
const _forward = new THREE.Vector3()
const _right = new THREE.Vector3()
const _screenUp = new THREE.Vector3()
const _up = new THREE.Vector3()

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

function loadCityGltf (url) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.setDRACOLoader(getDracoLoader())
    loader.load(url, resolve, undefined, reject)
  })
}

function matNames (obj) {
  const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
  return mats.map((m) => m?.name || '').join(' ')
}

function isIgnoredMesh (obj) {
  return IGNORE_MAT.test(matNames(obj))
}

/** 摆场测量排除水面片，避免 AABB 被 caustic 拉歪/侧视成细条 */
function isStageExcludeMesh (obj) {
  return isIgnoredMesh(obj) || /WATERFRONT|caustic|wake/i.test(matNames(obj))
}

/**
 * 原模型直出：不做观感处理。
 * 仅 colorSpace（Three 正确显示贴图必需）+ sceneBaseOpacity（幕透明度混合必需）。
 */
function tuneCityMaterials (root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return
    obj.frustumCulled = false
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const mat of mats) {
      if (!mat) continue
      if (mat.map) {
        mat.map.colorSpace = THREE.SRGBColorSpace
        mat.map.needsUpdate = true
      }
      if (mat.emissiveMap) {
        mat.emissiveMap.colorSpace = THREE.SRGBColorSpace
      }
      mat.userData.sceneBaseOpacity = mat.opacity ?? 1
    }
  })
}

/**
 * AABB of visible city body for stage fit.
 * Includes STAR；排除 rain/wake/logos/水面片（水面不参与居中与缩放）。
 */
function measureCityBody (content) {
  _box.makeEmpty()
  _com.set(0, 0, 0)
  let wSum = 0
  content.updateMatrixWorld(true)
  content.traverse((obj) => {
    if (!obj.isMesh || !obj.visible || isStageExcludeMesh(obj)) return
    _meshBox.setFromObject(obj)
    if (_meshBox.isEmpty()) return
    _box.union(_meshBox)
    const s = _meshBox.getSize(new THREE.Vector3())
    const c = _meshBox.getCenter(new THREE.Vector3())
    const w = Math.max(s.y * s.z, s.x * s.z, s.x * s.y)
    if (w < 1e-12) return
    _com.x += c.x * w
    _com.y += c.y * w
    _com.z += c.z * w
    wSum += w
  })
  if (_box.isEmpty()) {
    _box.setFromObject(content)
    _box.getCenter(_center)
  } else if (wSum > 0) {
    _center.copy(_com).multiplyScalar(1 / wSum)
  } else {
    _box.getCenter(_center)
  }
  _box.getSize(_size)

  return {
    size: _size.clone(),
    center: _center.clone()
  }
}

function centerContentOnPivot (content) {
  const { center } = measureCityBody(content)
  content.position.x -= center.x
  content.position.y -= center.y
  content.position.z -= center.z
  content.updateMatrixWorld(true)
}

/**
 * 将最大 STAR 盘钉到 pivot 原点，保证 2.5D 卡片正面朝向 CITY_CAMERA。
 * （仅加载期一次，不是每帧 NDC 锁）
 */
function pinStarToOrigin (content) {
  let best = null
  let bestR = -1
  content.updateMatrixWorld(true)
  content.traverse((obj) => {
    if (!obj.isMesh || !obj.visible) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    if (!mats.some((m) => m && /^STAR$/i.test(m.name || ''))) return
    const g = obj.geometry
    if (!g) return
    if (!g.boundingSphere) g.computeBoundingSphere()
    const r = g.boundingSphere?.radius || 0
    if (r > bestR) {
      bestR = r
      best = obj
    }
  })
  if (!best || !content.parent) return
  best.getWorldPosition(_starWorld)
  _starLocal.copy(_starWorld)
  content.parent.worldToLocal(_starLocal)
  content.position.x -= _starLocal.x
  content.position.y -= _starLocal.y
  content.position.z -= _starLocal.z
  content.updateMatrixWorld(true)
}

/**
 * One-shot stage placement relative to pivot origin.
 * World placement (look + STAGE_OFFSET) is applied on root in loadCityBlock.
 */
function prepareStage (pivot, content) {
  content.position.set(0, 0, 0)
  content.quaternion.identity()
  content.rotation.set(0, 0, 0)
  content.scale.set(1, 1, 1)
  pivot.position.set(0, 0, 0)
  pivot.quaternion.identity()
  pivot.scale.set(1, 1, 1)

  centerContentOnPivot(content)

  const { size } = measureCityBody(content)
  const maxEdge = Math.max(size.x, size.y, size.z, 1e-6)
  const actualScale = (BODY_TARGET_SIZE / maxEdge) * STAGE_SCALE
  content.scale.setScalar(actualScale)
  content.updateMatrixWorld(true)
  centerContentOnPivot(content)

  content.rotation.set(
    STAGE_EULER_YXZ[0],
    STAGE_EULER_YXZ[1],
    STAGE_EULER_YXZ[2],
    'YXZ'
  )
  content.updateMatrixWorld(true)
  centerContentOnPivot(content)
  pinStarToOrigin(content)

  return { actualScale }
}

/**
 * root 放到 look，再沿相机右/上/视线偏移（STAGE_OFFSET 为屏幕语义）。
 * @param {THREE.Group} root
 * @param {number[]} look
 * @param {{ position: number[], up: number[] }} camera
 */
function placeRootInCameraFrame (root, look, camera) {
  _look.set(look[0], look[1], look[2])
  if (!camera?.position || !camera?.up) {
    root.position.set(
      look[0] + STAGE_OFFSET[0],
      look[1] + STAGE_OFFSET[1],
      look[2] + STAGE_OFFSET[2]
    )
    return
  }
  _camPos.set(camera.position[0], camera.position[1], camera.position[2])
  _up.set(camera.up[0], camera.up[1], camera.up[2]).normalize()
  _forward.subVectors(_look, _camPos).normalize()
  _right.crossVectors(_forward, _up)
  if (_right.lengthSq() < 1e-8) {
    _up.set(0, 1, 0)
    _right.crossVectors(_forward, _up)
  }
  _right.normalize()
  _screenUp.crossVectors(_right, _forward).normalize()
  root.position
    .copy(_look)
    .addScaledVector(_right, STAGE_OFFSET[0])
    .addScaledVector(_screenUp, STAGE_OFFSET[1])
    .addScaledVector(_forward, STAGE_OFFSET[2])
}

/**
 * @param {string} [url]
 * @param {number[]} [look]
 * @param {{ playAnimation?: boolean, camera?: { position: number[], up: number[] } }} [options]
 */
export async function loadCityBlock (
  url = CITY_MODEL_URL,
  look = DEFAULT_LOOK,
  options = {}
) {
  const playAnimation = options.playAnimation !== false
  const gltf = await loadCityGltf(url)

  const root = new THREE.Group()
  root.name = 'CityFixedStage'
  const pivot = new THREE.Group()
  pivot.name = 'CityPivot'
  const content = gltf.scene
  content.name = content.name || 'CityContent'
  pivot.add(content)
  root.add(pivot)

  tuneCityMaterials(content)

  let mixer = null
  if (gltf.animations?.length && playAnimation) {
    mixer = new THREE.AnimationMixer(content)
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip)
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.play()
    }
  }

  const { actualScale } = prepareStage(pivot, content)

  placeRootInCameraFrame(root, look, options.camera)

  const block = {
    root,
    pivot,
    content,
    mixer,
    stage: {
      scale: actualScale,
      offset: STAGE_OFFSET.slice(),
      euler: STAGE_EULER_YXZ.slice()
    }
  }

  console.info(
    '[landing-bg] city stage:',
    url,
    `meshes≈${countMeshes(content)}`,
    `stageScale=${actualScale.toFixed(3)}`,
    `frameOffset=[${STAGE_OFFSET.map((n) => n.toFixed(1)).join(',')}]`,
    playAnimation ? 'anim=on' : 'anim=off'
  )

  if (typeof window !== 'undefined') {
    window.__cityDebug = { block, stage: block.stage }
  }
  return block
}

function countMeshes (root) {
  let n = 0
  root.traverse((o) => {
    if (o.isMesh && o.visible) n++
  })
  return n
}
