import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import { PALETTE, SWORDSMAN_MODEL_URL } from '../constants.js'
import {
  createCharacterAnimator,
  CLIP_DRAW,
  CLIP_SMASH,
  CLIP_STORM
} from './animator.js'

const CYAN = PALETTE.neonCyan

const FLYING_SWORD = {
  length: 2.65,
  width: 0.3,
  thickness: 0.08,
  y: 0.04,
  z: 0.12,
  tiltX: -0.12,
  scale: 1.1
}

const FLY_POSE = {
  hips: { x: 0.06, z: 0.03 },
  spine: { x: 0.34, z: 0.05 },
  chest: { x: 0.12, z: -0.03 },
  upperChest: { x: 0.07 },
  neck: { x: 0.04 },
  head: { x: -0.1, y: 0.05 },
  leftShoulder: { z: 0.08 },
  rightShoulder: { z: -0.06 },
  leftUpperArm: { z: -0.28, x: -0.28, y: 0.05 },
  rightUpperArm: { z: 0.22, x: -0.32, y: -0.08 },
  leftLowerArm: { x: -0.18, z: 0.08 },
  rightLowerArm: { x: -0.42, y: 0.12 },
  leftUpperLeg: { x: -0.4, z: 0.06 },
  rightUpperLeg: { x: -0.36, z: -0.05 },
  leftLowerLeg: { x: 0.3 },
  rightLowerLeg: { x: 0.26 }
}

const BONE_NAMES = Object.keys(FLY_POSE)

const SWAY = {
  spine: 0.035,
  spineRoll: 0.018,
  swordBob: 0.012,
  swordPitch: 0.04
}

const MODEL = {
  scale: 1.02,
  groundY: 0,
  rotationY: Math.PI
}

function createFlyingSwordMesh () {
  const sword = new THREE.Group()
  sword.name = 'Sword'

  const bladeCore = new THREE.Mesh(
    new THREE.BoxGeometry(FLYING_SWORD.length, FLYING_SWORD.thickness, FLYING_SWORD.width),
    new THREE.MeshStandardMaterial({
      color: 0x1a3048,
      emissive: CYAN,
      emissiveIntensity: 1.6,
      metalness: 0.92,
      roughness: 0.18,
      transparent: true,
      opacity: 0.88
    })
  )
  bladeCore.position.set(FLYING_SWORD.length * 0.08, 0, 0)
  sword.add(bladeCore)

  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(FLYING_SWORD.length * 1.02, FLYING_SWORD.thickness * 0.45, FLYING_SWORD.width * 1.1),
    new THREE.MeshBasicMaterial({
      color: CYAN,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  )
  edge.position.copy(bladeCore.position)
  sword.add(edge)

  sword.userData.blade = bladeCore
  sword.userData.edge = edge
  sword.scale.setScalar(FLYING_SWORD.scale)
  return sword
}

function createContactShadow () {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 32),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.42,
      depthWrite: false
    })
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.01
  return shadow
}

function createFloorAura () {
  const aura = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.54, 48),
    new THREE.MeshBasicMaterial({
      color: CYAN,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  )
  aura.rotation.x = -Math.PI / 2
  aura.position.y = 0.015
  return aura
}

function tuneMToonForSpace (root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const m of mats) {
      if (!m || typeof m.shadeColor === 'undefined') continue
      m.shadeColor?.set?.(0x1e2438)
      m.rimColor?.set?.(0x88d8f8)
      m.rimLightingMix = Math.min(0.9, (m.rimLightingMix ?? 0.5) + 0.25)
      m.parametricRimFresnelPower = 2.6
      m.outlineWidthFactor = Math.max(m.outlineWidthFactor ?? 0.5, 0.65)
      m.envMapIntensity = 0.65
      obj.castShadow = true
      obj.receiveShadow = true
    }
  })
}

function collectHitTargets (modelRoot, sword) {
  const targets = []
  modelRoot.traverse((child) => {
    if (child.isSkinnedMesh || (child.isMesh && child.name !== 'Sword')) {
      targets.push(child)
    }
  })
  if (sword) {
    sword.traverse((child) => {
      if (child.isMesh) targets.push(child)
    })
  }
  return targets
}

function captureRestPose (vrm) {
  const rest = {}
  for (const name of BONE_NAMES) {
    const node = vrm.humanoid.getNormalizedBoneNode(name)
    if (!node) continue
    rest[name] = { x: node.rotation.x, y: node.rotation.y, z: node.rotation.z }
  }
  return rest
}

function applyFlyPose (vrm, rest, sway) {
  for (const name of BONE_NAMES) {
    const node = vrm.humanoid.getNormalizedBoneNode(name)
    if (!node || !rest[name]) continue
    const pose = FLY_POSE[name]
    const extraX = name === 'spine' ? sway * SWAY.spine : 0
    const extraZ = name === 'spine' ? sway * SWAY.spineRoll : 0
    node.rotation.x = rest[name].x + (pose?.x ?? 0) + extraX
    node.rotation.y = rest[name].y + (pose?.y ?? 0)
    node.rotation.z = rest[name].z + (pose?.z ?? 0) + extraZ
  }
}

function alignModelToGround (model) {
  model.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  model.position.x -= center.x
  model.position.z -= center.z
  model.position.y = MODEL.groundY - box.min.y
}

function attachSwordToHand (vrm, sword) {
  const hand =
    vrm.humanoid.getNormalizedBoneNode('rightHand') ||
    vrm.humanoid.getNormalizedBoneNode('rightLowerArm')
  if (!hand) return false
  sword.rotation.set(FLYING_SWORD.tiltX, 0, Math.PI * 0.5)
  sword.position.set(0.08, 0.02, -0.05)
  hand.add(sword)
  return true
}

function loadVrmModel (url) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))
    loader.load(
      url,
      (gltf) => {
        const vrm = gltf.userData.vrm
        if (!vrm) {
          reject(new Error('VRM data missing'))
          return
        }
        resolve({ vrm, animations: gltf.animations ?? [] })
      },
      undefined,
      reject
    )
  })
}

export function createSwordsman () {
  const group = new THREE.Group()
  group.name = 'Swordsman'

  const modelRoot = new THREE.Group()
  modelRoot.name = 'SwordsmanModel'
  modelRoot.rotation.y = MODEL.rotationY
  group.add(modelRoot)

  const sword = createFlyingSwordMesh()
  modelRoot.add(sword)

  const contactShadow = createContactShadow()
  const floorAura = createFloorAura()
  modelRoot.add(contactShadow, floorAura)

  for (const light of createCharacterLights()) {
    group.add(light)
  }

  let vrm = null
  let restPose = {}
  let bodyMeshes = []
  let modelReady = false
  let visible = true
  let animator = null
  let skillsApi = null
  let postPipeline = null
  let wireFlashUntil = 0

  group.userData.hitTargets = collectHitTargets(modelRoot, sword)

  loadVrmModel(SWORDSMAN_MODEL_URL)
    .then(({ vrm: loaded, animations }) => {
      vrm = loaded
      VRMUtils.removeUnnecessaryVertices(vrm.scene)
      VRMUtils.combineSkeletons(vrm.scene)

      const model = vrm.scene
      model.scale.setScalar(MODEL.scale)
      tuneMToonForSpace(model)
      alignModelToGround(model)

      modelRoot.add(model)
      modelRoot.userData.body = model
      modelRoot.userData.vrm = vrm
      modelRoot.animations = animations

      if (attachSwordToHand(vrm, sword)) {
        sword.userData.attachedToHand = true
      } else {
        sword.rotation.set(FLYING_SWORD.tiltX, 0, 0)
        sword.position.set(0, FLYING_SWORD.y, FLYING_SWORD.z)
      }

      restPose = captureRestPose(vrm)
      bodyMeshes = []
      model.traverse((o) => {
        if (o.isMesh) bodyMeshes.push(o)
      })

      animator = createCharacterAnimator({
        vrm,
        root: modelRoot,
        onVfx: (id) => skillsApi?.runVfx?.(id),
        onSkillEnd: () => {}
      })

      group.userData.hitTargets = collectHitTargets(modelRoot, sword)
      modelReady = true
    })
    .catch((err) => {
      console.warn('[landing-bg] swordsman VRM load failed — run: pnpm run models:swordsman', err)
    })

  return {
    group,

    setSkills (skills) {
      skillsApi = skills
    },

    setPostPipeline (pipe) {
      postPipeline = pipe
    },

    playSkill (clipName) {
      if (!animator || animator.isBusy()) return false
      const ok = animator.playSkillClip(clipName)
      if (ok) {
        postPipeline?.pulseBloom?.(0.12, 260)
        wireFlashUntil = performance.now() + 220
      }
      return ok
    },

    triggerRandomSkill () {
      if (!animator) return false
      const name = animator.pickRandomSkill()
      return this.playSkill(name)
    },

    isSkillBusy () {
      return animator?.isBusy() ?? false
    },

    updateFly (elapsed, deltaSec = 0.016) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const sway = reducedMotion ? 0 : Math.sin(elapsed * 0.0012)
      const sway2 = reducedMotion ? 0 : Math.sin(elapsed * 0.0018 + 1.2)

      if (modelReady && vrm) {
        if (reducedMotion) {
          applyFlyPose(vrm, restPose, 0)
          return
        }
        if (animator) {
          animator.update(deltaSec)
          if (!animator.hasClips() && !animator.isBusy()) {
            applyFlyPose(vrm, restPose, sway)
          }
        } else {
          applyFlyPose(vrm, restPose, sway)
        }
      }

      if (!sword.userData.attachedToHand) {
        sword.position.y = FLYING_SWORD.y + sway2 * SWAY.swordBob
        sword.rotation.x = FLYING_SWORD.tiltX + sway * SWAY.swordPitch
      }

      floorAura.material.opacity = 0.18 + 0.14 * Math.sin(elapsed * 0.003)
      floorAura.rotation.z += 0.004
      contactShadow.material.opacity = 0.32 + 0.1 * Math.sin(elapsed * 0.002)

      const blade = sword.userData.blade
      if (blade?.material) {
        blade.material.emissiveIntensity = 1.3 + 0.6 * Math.sin(elapsed * 0.004)
      }
      const edge = sword.userData.edge
      if (edge?.material) {
        edge.material.opacity = 0.4 + 0.3 * Math.sin(elapsed * 0.005)
      }

      if (performance.now() < wireFlashUntil && bodyMeshes.length) {
        for (const mesh of bodyMeshes) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          for (const m of mats) {
            if (m?.emissive) m.emissiveIntensity = (m.emissiveIntensity || 0) + 0.4
          }
        }
      }
    },

    updateExit (blend12) {
      if (group.userData.baseY === undefined) group.userData.baseY = group.position.y
      const offset = blend12 > 0.5 ? (blend12 - 0.5) * 6 : 0
      group.position.y = group.userData.baseY + offset

      const dissolve = blend12 > 0.35 ? (blend12 - 0.35) / 0.5 : 0
      if (modelReady) {
        for (const mesh of bodyMeshes) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          for (const mat of mats) {
            if (!mat) continue
            mat.transparent = dissolve > 0.02
            mat.opacity = 1 - dissolve * 0.88
            if (mat.emissiveIntensity !== undefined) {
              mat.emissiveIntensity = (mat.emissiveIntensity || 0) + dissolve * 0.6
            }
          }
        }
      }
      sword.visible = blend12 < 0.9

      visible = blend12 <= 0.85
      group.visible = visible
    },

    isVisible () {
      return visible
    },

    isModelReady () {
      return modelReady
    }
  }
}

function createCharacterLights () {
  const key = new THREE.DirectionalLight(0xe8f0ff, 1.05)
  key.position.set(2.5, 5, 4)
  key.castShadow = true
  key.shadow.mapSize.set(512, 512)
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 18
  key.shadow.camera.left = -3
  key.shadow.camera.right = 3
  key.shadow.camera.top = 3
  key.shadow.camera.bottom = -3
  key.shadow.bias = -0.0008

  const fill = new THREE.DirectionalLight(0x5a6880, 0.42)
  fill.position.set(-4, 2, -3)

  const rim = new THREE.PointLight(0x66d8ff, 0.85, 14)
  rim.position.set(-1.2, 2.2, 1.4)

  const rimMagenta = new THREE.PointLight(0xe06098, 0.35, 10)
  rimMagenta.position.set(1.4, 1.6, -0.8)

  const under = new THREE.PointLight(0x4a7898, 0.5, 8)
  under.position.set(0, 0.4, 0.6)

  return [key, fill, rim, rimMagenta, under]
}

/** @deprecated use createSwordsman */
export function createSwordsmanPlaceholder () {
  return createSwordsman()
}

export { CLIP_DRAW, CLIP_SMASH, CLIP_STORM }
