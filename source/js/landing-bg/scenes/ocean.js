import * as THREE from 'three'
import {
  bindFeaturedBgColorUniform,
  createFeaturedBgMesh,
  createFeaturedSharedUniforms,
  updateFeaturedBg,
  FEATURED_CYAN,
  resolveFeaturedOceanTheme
} from '../materials/featured-scene.js'
import { createFeaturedParticleField } from './ocean-particles.js'

function createFeaturedOceanBackdrop (sharedUniforms) {
  const mesh = createFeaturedBgMesh(sharedUniforms)
  bindFeaturedBgColorUniform(sharedUniforms, mesh)
  mesh.userData.noSceneBlend = true
  return mesh
}

export function createOceanFeaturedUniforms (cameraPosition, mouse3) {
  return createFeaturedSharedUniforms(cameraPosition, mouse3)
}

export function createOceanScene ({
  cameraPosition,
  mouse3,
  sharedUniforms,
  renderer,
  getViewportCssHeight
} = {}) {
  const group = new THREE.Group()
  const camPos = cameraPosition ?? new THREE.Vector3()
  const mouse = mouse3 ?? new THREE.Vector3()
  const shared = sharedUniforms ?? createFeaturedSharedUniforms(camPos, mouse)

  const backdrop = createFeaturedOceanBackdrop(shared)
  group.add(backdrop)

  const particles = renderer
    ? createFeaturedParticleField(renderer, shared, camPos, {
      getViewportCssHeight
    })
    : null
  if (particles) group.add(particles.points)

  return {
    group,
    backdrop,
    sharedUniforms: shared,
    getTheme: () => resolveFeaturedOceanTheme(),
    seedVerticalSpread () {
      particles?.seedVerticalSpread?.()
    },
    samplePositionYStats () {
      return particles?.samplePositionYStats?.() ?? null
    },
    update (_followTarget, _elapsed, delta, _lightState, camera) {
      const theme = resolveFeaturedOceanTheme()
      if (camera) updateFeaturedBg(shared, camera, theme)
      particles?.update(delta, theme)
    }
  }
}
