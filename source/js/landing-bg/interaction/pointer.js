import * as THREE from 'three'
import {
  OCEAN_CREATURE_Z_CENTER,
  OCEAN_MAIN_JELLY_CURSOR_OFFSET_PX
} from '../constants.js'
import { clampOceanXY } from '../ocean-bounds.js'
import { getElasticMouse } from '../engine/motion.js'
import { updateFeaturedMouse } from '../engine/featured-viewport.js'
import { FEATURED_CYAN } from '../materials/featured-scene.js'

function screenPxToWorldOnPlane (px, camera, mouse3) {
  const vFov = THREE.MathUtils.degToRad(camera.fov)
  const dist = Math.max(camera.position.distanceTo(mouse3), 0.1)
  const viewHeight = 2 * Math.tan(vFov / 2) * dist
  return (px / Math.max(window.innerHeight, 1)) * viewHeight
}

/**
 * featured 区块鼠标追踪（mouseRefToWindow: true）
 */
export function createPointerSystem ({
  camera,
  swordsman,
  skills,
  getScrollState,
  getFeaturedMetrics,
  cameraPosition,
  mouse3,
  sharedUniforms
}) {
  let oceanMode = false

  function updateMouse () {
    const metrics = getFeaturedMetrics?.()
    if (!metrics) return
    updateFeaturedMouse(camera, mouse3, getElasticMouse(), metrics)
  }

  function syncCameraPosition () {
    camera.updateMatrixWorld(true)
    camera.matrixWorld.decompose(
      cameraPosition,
      new THREE.Quaternion(),
      new THREE.Vector3()
    )
  }

  function setOceanMode (active) {
    oceanMode = active
    if (active) {
      camera.updateMatrixWorld(true)
      updateMouse()
      syncCameraPosition()
    }
  }

  function onPointerMove () {
    if (!getScrollState().oceanInteractive) return
    updateMouse()
  }

  function onPointerDown (e) {
    if (!swordsman.isVisible()) return
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2(
      (e.clientX / (window.innerWidth || 1)) * 2 - 1,
      1 - (e.clientY / (window.innerHeight || 1)) * 2
    )
    raycaster.setFromCamera(ndc, camera)
    const hits = raycaster.intersectObjects(swordsman.group.userData.hitTargets, true)
    if (hits.length) skills.triggerRandom()
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerdown', onPointerDown)

  return {
    updateFromElastic () {
      if (!oceanMode) return
      updateMouse()
      syncCameraPosition()
    },
    setOceanMode,
    isPointerEngaged () {
      return oceanMode
    },
    getFollowTarget () {
      const target = mouse3.clone()
      target.z = OCEAN_CREATURE_Z_CENTER
      target.y -= screenPxToWorldOnPlane(OCEAN_MAIN_JELLY_CURSOR_OFFSET_PX, camera, mouse3)
      const clamped = clampOceanXY(target.x, target.y)
      target.x = clamped.x
      target.y = clamped.y
      return target
    },
    getFeaturedTheme () {
      return FEATURED_CYAN
    },
    sharedUniforms,
    dispose () {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }
}
