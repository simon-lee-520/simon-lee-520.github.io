import * as THREE from 'three'
import { jellyMetrics } from './jelly-appearance.js'

const JELLY_LIT_KEY = 'jellyLitV1'

const _color = new THREE.Color()

function hexToVec3 (hex) {
  _color.setHex(hex)
  return new THREE.Vector3(_color.r, _color.g, _color.b)
}

/** Lathe 伞盖：写入高度(0=缘,1=顶)与径向(0=轴,1=缘) */
export function bindJellyBellAttributes (geometry, bellScale = 1) {
  const { H, R, marginY } = jellyMetrics(bellScale)
  const pos = geometry.attributes.position
  const heights = new Float32Array(pos.count)
  const radials = new Float32Array(pos.count)

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const x = pos.getX(i)
    const z = pos.getZ(i)
    heights[i] = THREE.MathUtils.clamp((y - marginY) / Math.max(H, 1e-4), 0, 1)
    radials[i] = THREE.MathUtils.clamp(Math.hypot(x, z) / Math.max(R, 1e-4), 0, 1)
  }

  geometry.setAttribute('aBellHeight', new THREE.BufferAttribute(heights, 1))
  geometry.setAttribute('aBellRadial', new THREE.BufferAttribute(radials, 1))
}

/** 触手管：沿长度 0→1 */
export function bindStrandAlongAttribute (geometry, tubularSegments) {
  const pos = geometry.attributes.position
  const row = Math.floor(pos.count / (tubularSegments + 1)) || 1
  const along = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    along[i] = Math.floor(i / row) / tubularSegments
  }
  geometry.setAttribute('aAlong', new THREE.BufferAttribute(along, 1))
}

function wireScatterWorld (shader) {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
      varying vec3 vJellyWorldPos;`
    )
    .replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      vJellyWorldPos = worldPosition.xyz;`
    )
}

/**
 * 动漫水母伞盖：菲涅尔缘光 + 假 SSS + 暖芯渗漏
 * @param {object} look — JELLY_LOOK_PRESETS 项
 * @param {{ isMain?: boolean, inner?: boolean }} opts
 */
export function createJellyBellMaterial (look, opts = {}) {
  const { isMain = true, inner = false } = opts
  const mat = new THREE.MeshPhysicalMaterial({
    color: look.bellColor,
    roughness: 0.15,
    metalness: 0,
    transparent: true,
    opacity: inner ? 0.2 : 0.42,
    depthWrite: false,
    side: inner ? THREE.BackSide : THREE.FrontSide,
    envMapIntensity: 0
  })

  const uniforms = {
    uBellBody: { value: hexToVec3(look.bellColor) },
    uBellGlow: { value: hexToVec3(look.bellEmissive) },
    uRim: { value: hexToVec3(look.rim) },
    uCoreTint: { value: hexToVec3(look.coreEmissive) },
    uOpacityBase: { value: inner ? 0.14 : isMain ? 0.32 : 0.26 },
    uOpacityRim: { value: inner ? 0.28 : isMain ? 0.72 : 0.58 },
    uEmissive: { value: inner ? 0.08 : isMain ? 0.22 : 0.16 },
    uInner: { value: inner ? 1 : 0 },
    uPulse: { value: 0 }
  }
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    mat.userData.jellyUniforms = uniforms

    shader.vertexShader = `
      attribute float aBellHeight;
      attribute float aBellRadial;
      varying float vBellHeight;
      varying float vBellRadial;
      varying vec3 vJellyWorldNormal;
      ${shader.vertexShader}
    `
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      vBellHeight = aBellHeight;
      vBellRadial = aBellRadial;`
      )

    wireScatterWorld(shader)
    shader.vertexShader = shader.vertexShader.replace(
      '#include <normal_vertex>',
      `#include <normal_vertex>
      #ifdef USE_INSTANCING
        mat4 jm = modelMatrix * instanceMatrix;
      #else
        mat4 jm = modelMatrix;
      #endif
      vJellyWorldNormal = normalize(mat3(jm) * objectNormal);`
    )

    shader.fragmentShader = `
      uniform vec3 uBellBody;
      uniform vec3 uBellGlow;
      uniform vec3 uRim;
      uniform vec3 uCoreTint;
      uniform float uOpacityBase;
      uniform float uOpacityRim;
      uniform float uEmissive;
      uniform float uInner;
      uniform float uPulse;
      varying float vBellHeight;
      varying float vBellRadial;
      varying vec3 vJellyWorldPos;
      varying vec3 vJellyWorldNormal;
      ${shader.fragmentShader}
    `.replace(
      '#include <output_fragment>',
      `vec3 V = normalize(cameraPosition - vJellyWorldPos);
      vec3 N = normalize(vJellyWorldNormal * uPointerNormalFlip);
      float fresnel = pow(1.0 - max(dot(N, V), 0.0), mix(2.4, 3.8, vBellRadial));
      float thickness = mix(vBellRadial, 1.0 - vBellHeight, 0.45);
      float coreBleed = exp(-pow(vBellRadial * 1.35, 2.0)) * smoothstep(0.35, 0.95, vBellHeight);
      coreBleed *= 1.0 + uPulse * 0.35;

      vec3 body = mix(uBellBody, uBellGlow, (1.0 - thickness) * 0.55);
      body = mix(body, uCoreTint, coreBleed * mix(0.35, 0.65, uInner));
      vec3 rimCol = uRim * (fresnel * 1.15 + 0.12);
      vec3 col = body + rimCol;
      col += uBellGlow * uEmissive * (fresnel * 0.65 + coreBleed * 0.4);

      float alpha = mix(uOpacityBase, uOpacityRim, fresnel);
      alpha *= mix(0.55, 1.0, thickness);
      alpha *= 1.0 - coreBleed * 0.15;
      alpha = clamp(alpha, 0.04, 0.92);

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor = vec4(col, alpha);`
    )
  }

  mat.customProgramCacheKey = () =>
    `${JELLY_LIT_KEY}-bell-${inner ? 1 : 0}-${isMain ? 1 : 0}`
  mat.userData[JELLY_LIT_KEY] = true
  mat.userData.sceneBaseOpacity = mat.opacity
  return mat
}

/** 暖色胃囊核：径向柔光 */
export function createJellyCoreMaterial (look, isMain = true) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: look.coreColor,
    emissive: look.coreEmissive,
    emissiveIntensity: isMain ? 0.55 : 0.4,
    roughness: 0.35,
    metalness: 0,
    transparent: true,
    opacity: isMain ? 0.92 : 0.8,
    depthWrite: false
  })

  const uniforms = {
    uCore: { value: hexToVec3(look.coreColor) },
    uEmissive: { value: hexToVec3(look.coreEmissive) },
    uIntensity: { value: isMain ? 1.35 : 1.05 },
    uPulse: { value: 0 }
  }

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    mat.userData.jellyUniforms = uniforms

    shader.vertexShader = `
      varying vec3 vCoreLocal;
      ${shader.vertexShader}
    `.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vCoreLocal = position;`
    )

    shader.fragmentShader = `
      uniform vec3 uCore;
      uniform vec3 uEmissive;
      uniform float uIntensity;
      uniform float uPulse;
      varying vec3 vCoreLocal;
      ${shader.fragmentShader}
    `.replace(
      '#include <output_fragment>',
      `float r = length(vCoreLocal.xz) / max(length(vCoreLocal), 0.001);
      float soft = 1.0 - smoothstep(0.25, 1.0, r);
      soft = pow(soft, 1.4);
      vec3 col = mix(uCore, uEmissive, soft * 0.85);
      col += uEmissive * uIntensity * (0.45 + soft * 0.9) * (1.0 + uPulse * 0.25);
      float alpha = mix(0.65, 0.98, soft);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor = vec4(col, alpha);`
    )
  }

  mat.customProgramCacheKey = () => `${JELLY_LIT_KEY}-core-${isMain ? 1 : 0}`
  mat.userData[JELLY_LIT_KEY] = true
  mat.userData.sceneBaseOpacity = mat.opacity
  return mat
}

/** 口腕 / 缘毛：沿长度渐隐 + 手电 */
export function createJellyStrandMaterial (look, isMain, kind) {
  const oral = kind === 'oral'
  const mat = new THREE.MeshPhysicalMaterial({
    color: oral ? look.oralColor : 0xc8e8f8,
    roughness: oral ? 0.72 : 0.95,
    metalness: 0,
    emissive: oral ? look.oralEmissive : look.strandEmissive,
    emissiveIntensity: oral ? (isMain ? 0.14 : 0.1) : isMain ? 0.08 : 0.055,
    transparent: true,
    opacity: oral ? (isMain ? 0.58 : 0.45) : isMain ? 0.38 : 0.28,
    depthWrite: false,
    side: THREE.DoubleSide
  })

  const uniforms = {
    uStrandColor: { value: hexToVec3(oral ? look.oralColor : 0xc8e8f8) },
    uStrandGlow: { value: hexToVec3(oral ? look.oralEmissive : look.strandEmissive) },
    uOral: { value: oral ? 1 : 0 },
    uOpacity: { value: mat.opacity }
  }
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    mat.userData.jellyUniforms = uniforms

    shader.vertexShader = `
      attribute float aAlong;
      varying float vAlong;
      varying vec3 vJellyWorldNormal;
      ${shader.vertexShader}
    `.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vAlong = aAlong;`
    )

    wireScatterWorld(shader)
    shader.vertexShader = shader.vertexShader.replace(
      '#include <normal_vertex>',
      `#include <normal_vertex>
      #ifdef USE_INSTANCING
        mat4 jm = modelMatrix * instanceMatrix;
      #else
        mat4 jm = modelMatrix;
      #endif
      vJellyWorldNormal = normalize(mat3(jm) * objectNormal);`
    )

    shader.fragmentShader = `
      uniform vec3 uStrandColor;
      uniform vec3 uStrandGlow;
      uniform float uOral;
      uniform float uOpacity;
      varying float vAlong;
      varying vec3 vJellyWorldPos;
      varying vec3 vJellyWorldNormal;
      ${shader.fragmentShader}
    `.replace(
      '#include <output_fragment>',
      `float tipFade = 1.0 - pow(vAlong, mix(1.6, 2.4, uOral));
      float rootBright = 1.0 - smoothstep(0.0, 0.15, vAlong);
      vec3 col = mix(uStrandColor, uStrandGlow, rootBright * 0.4 + tipFade * 0.2);
      col += uStrandGlow * (0.08 + rootBright * 0.12) * (1.0 - vAlong * 0.5);
      float alpha = uOpacity * tipFade * mix(0.85, 1.0, rootBright);
      alpha *= mix(0.7, 1.0, uOral);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.95));`
    )
  }

  mat.customProgramCacheKey = () =>
    `${JELLY_LIT_KEY}-strand-${kind}-${isMain ? 1 : 0}`
  mat.userData[JELLY_LIT_KEY] = true
  mat.userData.sceneBaseOpacity = mat.opacity
  return mat
}

/** 口腕蓬松云雾（叠加小球） */
export function createJellyOralCloudMaterial (look, isMain = true) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: look.oralColor,
    emissive: look.coreEmissive,
    emissiveIntensity: isMain ? 0.35 : 0.25,
    roughness: 0.9,
    transparent: true,
    opacity: isMain ? 0.42 : 0.32,
    depthWrite: false
  })

  const uniforms = {
    uTint: { value: hexToVec3(look.oralColor) },
    uWarm: { value: hexToVec3(look.coreEmissive) },
    uPulse: { value: 0 }
  }

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    mat.userData.jellyUniforms = uniforms

    shader.fragmentShader = `
      uniform vec3 uTint;
      uniform vec3 uWarm;
      uniform float uPulse;
      ${shader.fragmentShader}
    `.replace(
      '#include <output_fragment>',
      `float n = fract(sin(dot(vUv * 12.0, vec2(12.9898, 78.233))) * 43758.5453);
      vec3 col = mix(uTint, uWarm, 0.35 + n * 0.25);
      col += uWarm * (0.25 + uPulse * 0.2);
      float alpha = 0.38 + n * 0.12;
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor = vec4(col, alpha);`
    )
  }

  mat.customProgramCacheKey = () => `${JELLY_LIT_KEY}-oral-cloud`
  mat.userData[JELLY_LIT_KEY] = true
  mat.userData.sceneBaseOpacity = mat.opacity
  return mat
}

export function updateJellyPulse (root, pulse) {
  if (!root) return
  root.traverse((obj) => {
    const u = obj.material?.userData?.jellyUniforms
    if (u?.uPulse) u.uPulse.value = pulse
  })
}

