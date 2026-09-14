import * as THREE from 'three'
import { FEATURED_THEMES } from './light-scatter.js'

/** featured 主题表 [2]（青色海水）— 颜色与 scatter 原样 */
export const FEATURED_CYAN = {
  ...FEATURED_THEMES[2],
  lightDistance: 9
}

/** getScatter GLSL */
export const GET_SCATTER_GLSL = `
uniform float u_lightScatterDivider;
uniform float u_lightScatterPowInv;
uniform vec3 u_lightColor;
uniform vec3 u_lightPosition;
uniform vec3 u_cameraPosition;

float getScatter(vec3 start, vec3 dir, vec3 lightPos, float d) {
  vec3 q = start - lightPos;
  float b = dot(dir, q);
  float c = dot(q, q);
  float t = c - b * b;
  float s = 1.0 / sqrt(max(0.0, t));
  float l = s * (atan((d + b) * s) - atan(b * s));
  return pow(max(0.0, l / u_lightScatterDivider), u_lightScatterPowInv);
}
`

/** featured 背景顶点着色器 */
export const FEATURED_BG_VERT = `
varying vec3 v_worldPosition;
void main () {
  v_worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

/** featured 背景片元着色器（含 dithering） */
export const FEATURED_BG_FRAG = `
uniform vec3 u_color;
varying vec3 v_worldPosition;

${GET_SCATTER_GLSL}

vec3 dithering( vec3 color ) {
  float grid_position = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
  dither_shift_RGB = mix( 2.0 * dither_shift_RGB, 2.0 * dither_shift_RGB - 1.0, grid_position );
  return color + dither_shift_RGB;
}

void main () {
  vec3 toCameraWorld = v_worldPosition - u_cameraPosition;
  vec3 nToCameraWorldDir = normalize(toCameraWorld);
  float toCameraDist = length(toCameraWorld);
  float scatter = getScatter(u_cameraPosition, nToCameraWorldDir, u_lightPosition, toCameraDist);
  vec3 color = u_color * 0.15 * (0.65 + 0.4 * scatter) + scatter * u_lightColor;
  gl_FragColor = vec4(dithering(color), 1.0);
}
`

/** featured 场景共享 uniform（u_lightPosition = mouse3 引用，从不关闭） */
export function createFeaturedSharedUniforms (cameraPosition, mouse3) {
  const t = FEATURED_CYAN
  return {
    u_lightScatterDivider: { value: t.scatterDivider },
    u_lightScatterPowInv: { value: t.scatterPowInv },
    u_cameraPosition: { value: cameraPosition },
    u_lightColor: { value: new THREE.Color(t.lightColor) },
    u_lightPosition: { value: mouse3 },
    u_lightViewPosition: { value: new THREE.Vector3() },
    u_lightDistance: { value: t.lightDistance },
    u_diffMultiplier: { value: t.diffMultiplier },
    u_specMultiplier: { value: t.specMultiplier }
  }
}

/** featured 背景平面 mesh */
export function createFeaturedBgMesh (sharedUniforms) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.ShaderMaterial({
      uniforms: {
        u_color: { value: new THREE.Color(FEATURED_CYAN.backgroundColor) },
        u_lightColor: sharedUniforms.u_lightColor,
        u_lightScatterDivider: sharedUniforms.u_lightScatterDivider,
        u_lightScatterPowInv: sharedUniforms.u_lightScatterPowInv,
        u_lightPosition: sharedUniforms.u_lightPosition,
        u_cameraPosition: sharedUniforms.u_cameraPosition
      },
      vertexShader: FEATURED_BG_VERT,
      fragmentShader: FEATURED_BG_FRAG,
      depthWrite: false,
      dithering: true
    })
  )
  mesh.position.z = -50
  mesh.frustumCulled = false
  return mesh
}

/** featured 背景每帧更新 */
export function updateFeaturedBg (sharedUniforms, camera, theme = FEATURED_CYAN) {
  const uColor = sharedUniforms._bgColorUniform
  if (uColor) uColor.value.setHex(theme.backgroundColor)
  sharedUniforms.u_lightViewPosition.value
    .copy(sharedUniforms.u_lightPosition.value)
    .applyMatrix4(camera.matrixWorldInverse)
  sharedUniforms.u_lightScatterDivider.value = theme.scatterDivider
  sharedUniforms.u_lightScatterPowInv.value = theme.scatterPowInv
  sharedUniforms.u_lightColor.value.setHex(theme.lightColor)
  sharedUniforms.u_lightDistance.value = theme.lightDistance ?? 9
  sharedUniforms.u_diffMultiplier.value = theme.diffMultiplier
  sharedUniforms.u_specMultiplier.value = theme.specMultiplier
}

export function bindFeaturedBgColorUniform (sharedUniforms, bgMesh) {
  sharedUniforms._bgColorUniform = bgMesh.material.uniforms.u_color
}
