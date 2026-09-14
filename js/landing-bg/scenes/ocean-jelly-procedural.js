import * as THREE from 'three'
import { LAYER_BLOOM, OCEAN_CREATURE_Z_CENTER } from '../constants.js'
import { JELLY_LOOK_PRESETS, jellyMetrics } from '../materials/jelly-appearance.js'
import {
  bindJellyBellAttributes,
  createJellyBellMaterial,
  createJellyCoreMaterial,
  createJellyOralCloudMaterial
} from '../materials/jelly-lit.js'
import {
  createJellyBellGeometry,
  createJellyBellInnerGeometry,
  createJellyCoreGeometry,
  createJellyOralCloud,
  createJellyTentacleSystem
} from '../geometries/creatures.js'

/** 程序化水母（远景 / GLB 加载失败时的主水母占位） */
export function createJellyfishSilhouette (isMain, lookIndex = 0) {
  const group = new THREE.Group()
  const bellScale = isMain ? 1 : 1.02
  const metrics = jellyMetrics(bellScale)
  const bellGeo = createJellyBellGeometry(bellScale)
  bindJellyBellAttributes(bellGeo, bellScale)
  const innerGeo = createJellyBellInnerGeometry(bellScale)
  bindJellyBellAttributes(innerGeo, bellScale)
  const look = JELLY_LOOK_PRESETS[lookIndex % JELLY_LOOK_PRESETS.length]

  const bell = new THREE.Mesh(bellGeo, createJellyBellMaterial(look, { isMain, inner: false }))
  bell.material.userData.sceneBaseOpacity = bell.material.opacity
  bell.renderOrder = 0
  group.add(bell)

  const bellInner = new THREE.Mesh(
    innerGeo,
    createJellyBellMaterial(look, { isMain, inner: true })
  )
  bellInner.material.userData.sceneBaseOpacity = bellInner.material.opacity
  bellInner.renderOrder = 0
  group.add(bellInner)

  const core = new THREE.Mesh(
    createJellyCoreGeometry(bellScale),
    createJellyCoreMaterial(look, isMain)
  )
  core.position.y = metrics.coreY
  core.material.userData.sceneBaseOpacity = core.material.opacity
  core.renderOrder = 1
  core.layers.enable(LAYER_BLOOM)
  group.add(core)

  const oralCloudMat = createJellyOralCloudMaterial(look, isMain)
  const oralCloud = createJellyOralCloud(bellScale, isMain, look, oralCloudMat)
  for (const child of oralCloud.children) {
    child.layers.enable(LAYER_BLOOM)
  }
  group.add(oralCloud)

  const tentacles = createJellyTentacleSystem(bellScale, isMain, look)
  group.add(tentacles.root)
  group.userData.tentacleStrands = tentacles.strands

  const planeZ = isMain
    ? OCEAN_CREATURE_Z_CENTER
    : OCEAN_CREATURE_Z_CENTER - 2 - Math.random() * 6

  group.userData.baseScale = isMain ? 0.94 : 0.98
  group.userData.metrics = metrics
  group.userData.bellScale = bellScale
  group.scale.setScalar(group.userData.baseScale)
  group.userData.isMain = isMain
  group.userData.phase = Math.random() * Math.PI * 2
  group.userData.planeZ = planeZ
  group.userData.driftN = {
    x: 0.08 + Math.random() * 0.84,
    y: 0.1 + Math.random() * 0.8
  }

  return group
}
