import * as THREE from 'three'
import { SCATTER_GLSL } from './light-scatter.js'

const FEATURED_LIT_KEY = 'featuredParticleLitV1'

/** featured 粒子光照 fragment（mesh 用法线替代 sprite N） */
export const FEATURED_PARTICLE_LIGHT_GLSL = `
uniform float u_lightDistance;
uniform float u_diffMultiplier;
uniform float u_specMultiplier;
uniform vec3 u_lightViewPosition;

float featuredClampRange (float minVal, float maxVal, float val) {
  return clamp((val - minVal) / (maxVal - minVal), 0.0, 1.0);
}

vec3 featuredParticleLight (
  vec3 baseColor,
  vec3 viewPos,
  vec3 viewNormal,
  vec3 worldPos,
  float brightness
) {
  vec3 N = normalize(viewNormal);
  vec3 viewGeometryPosition = -viewPos;

  vec3 LtoG = u_lightViewPosition - viewGeometryPosition;
  vec3 nLtoG = normalize(LtoG);
  float distLtoG = length(LtoG);
  float dotNL = dot(N, nLtoG);

  float lightDistanceWeight =
    pow(featuredClampRange(u_lightDistance, 0.0, distLtoG), 5.0) * (1.0 + brightness);

  float diffuseFactor = smoothstep(-0.75 - brightness, 0.75, dotNL);
  vec3 color = baseColor * diffuseFactor * lightDistanceWeight * u_diffMultiplier;

  float specDotValue = dot(reflect(normalize(viewGeometryPosition), N), nLtoG);
  float spec = smoothstep(0.8 - brightness, 0.85, specDotValue)
    * u_specMultiplier * lightDistanceWeight;
  color += spec * u_lightColor;

  vec3 toCameraWorld = worldPos - u_cameraPosition;
  vec3 nToCameraWorldDir = normalize(toCameraWorld);
  float toCameraDist = length(toCameraWorld);
  float scatter = getScatter(u_cameraPosition, nToCameraWorldDir, u_lightPosition, toCameraDist);
  color += color * 0.15 * (0.65 + 0.4 * scatter) + scatter * u_lightColor;

  return color;
}
`

function particleUniformRefs (sharedUniforms) {
  return {
    u_lightScatterDivider: sharedUniforms.u_lightScatterDivider,
    u_lightScatterPowInv: sharedUniforms.u_lightScatterPowInv,
    u_cameraPosition: sharedUniforms.u_cameraPosition,
    u_lightColor: sharedUniforms.u_lightColor,
    u_lightPosition: sharedUniforms.u_lightPosition,
    u_lightViewPosition: sharedUniforms.u_lightViewPosition,
    u_lightDistance: sharedUniforms.u_lightDistance,
    u_diffMultiplier: sharedUniforms.u_diffMultiplier,
    u_specMultiplier: sharedUniforms.u_specMultiplier
  }
}

/**
 * featured 粒子光照 + scatter（与 bg 共用 sharedUniforms）
 */
export function applyFeaturedParticleLight (material, sharedUniforms, options = {}) {
  if (!material || material.userData[FEATURED_LIT_KEY]) return material

  const brightness = options.brightness ?? 0
  const uniforms = particleUniformRefs(sharedUniforms)

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    material.userData.featuredUniforms = uniforms

    shader.vertexShader = `
      varying vec3 vFeaturedWorldPos;
      varying vec3 vFeaturedViewPos;
      varying vec3 vFeaturedViewNormal;
      ${shader.vertexShader}
    `.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      vFeaturedWorldPos = worldPosition.xyz;`
    ).replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vFeaturedViewPos = -mvPosition.xyz;
      vFeaturedViewNormal = normalize(normalMatrix * objectNormal);`
    )

    shader.fragmentShader = `
      ${SCATTER_GLSL}
      ${FEATURED_PARTICLE_LIGHT_GLSL}
      uniform float u_featuredBrightness;
      varying vec3 vFeaturedWorldPos;
      varying vec3 vFeaturedViewPos;
      varying vec3 vFeaturedViewNormal;
      ${shader.fragmentShader.replace(
        '#include <output_fragment>',
        `{
          outgoingLight = featuredParticleLight(
            diffuseColor.rgb,
            vFeaturedViewPos,
            vFeaturedViewNormal,
            vFeaturedWorldPos,
            u_featuredBrightness
          );
        }
        #include <output_fragment>`
      )}
    `
    shader.uniforms.u_featuredBrightness = { value: brightness }
  }

  material.customProgramCacheKey = () => `${FEATURED_LIT_KEY}-${brightness}`
  material.userData[FEATURED_LIT_KEY] = true
  material.userData.featuredUniforms = uniforms
  return material
}

export function applyFeaturedParticleToObject (root, sharedUniforms) {
  if (!root) return
  root.traverse((obj) => {
    const mats = obj.material
      ? Array.isArray(obj.material)
        ? obj.material
        : [obj.material]
      : []
    for (const mat of mats) {
      if (!mat?.userData?.[FEATURED_LIT_KEY]) {
        applyFeaturedParticleLight(mat, sharedUniforms, {
          brightness: mat.userData?.featuredBrightness ?? 0
        })
      }
    }
  })
}
