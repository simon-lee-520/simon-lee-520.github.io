import * as THREE from 'three'
import {
  SCATTER_GLSL,
  createScatterUniforms,
  updateScatterUniforms
} from './light-scatter.js'

const POINTER_LIT_KEY = 'pointerLitFeaturedV1'

/**
 * featured 粒子幕 getScatter 叠色
 * @param {{ scatterMode?: 'fish' | 'model' }} [options]
 */
export function applyPointerLightToStandardMaterial (material, options = {}) {
  if (!material || material.userData[POINTER_LIT_KEY]) return material

  const scatterMode = options.scatterMode ?? 'fish'
  const scatterUniforms = createScatterUniforms()

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, scatterUniforms)
    material.userData.scatterUniforms = scatterUniforms

    shader.vertexShader = `
      varying vec3 vScatterWorldPos;
      ${shader.vertexShader}
    `.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      vScatterWorldPos = worldPosition.xyz;`
    )

    const scatterAdd =
      scatterMode === 'model'
        ? 'outgoingLight += scatter * u_lightColor;'
        : 'outgoingLight += outgoingLight * 0.15 * (0.65 + 0.4 * scatter) + scatter * u_lightColor;'

    shader.fragmentShader = `
      ${SCATTER_GLSL}
      varying vec3 vScatterWorldPos;
      ${shader.fragmentShader.replace(
        '#include <output_fragment>',
        `{
          vec3 toCameraWorld = vScatterWorldPos - u_cameraPosition;
          vec3 nToCameraWorldDir = normalize(toCameraWorld);
          float toCameraDist = length(toCameraWorld);
          float scatter = getScatter(u_cameraPosition, nToCameraWorldDir, u_lightPosition, toCameraDist);
          ${scatterAdd}
        }
        #include <output_fragment>`
      )}
    `
  }

  material.customProgramCacheKey = () => `${POINTER_LIT_KEY}-${scatterMode}`
  material.userData[POINTER_LIT_KEY] = true
  material.userData.scatterUniforms = scatterUniforms
  return material
}

export function updatePointerLightUniforms (material, lightState, camera) {
  updateScatterUniforms(material?.userData?.scatterUniforms, camera, lightState)
}

export function applyPointerLightToObject (root, lightState, camera) {
  if (!root) return
  root.traverse((obj) => {
    const mats = obj.material
      ? Array.isArray(obj.material)
        ? obj.material
        : [obj.material]
      : []
    for (const mat of mats) {
      if (mat?.userData?.scatterUniforms) {
        updatePointerLightUniforms(mat, lightState, camera)
      }
    }
  })
}
