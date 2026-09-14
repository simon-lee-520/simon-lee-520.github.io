import * as THREE from 'three'

/** featured 场景 — getScatter 体积光 GLSL */
export const SCATTER_GLSL = `
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

/** featured 场景配色主题表 */
export const FEATURED_THEMES = [
  {
    diffMultiplier: 0.2,
    specMultiplier: 1,
    pointColor: 0xffffff,
    scatterDivider: 50,
    scatterPowInv: 0.7,
    lightColor: 0x4f4f4f,
    backgroundColor: 0x111111
  },
  {
    diffMultiplier: 0.5,
    specMultiplier: 1,
    pointColor: 0xff0b46,
    scatterDivider: 80,
    scatterPowInv: 0.5,
    lightColor: 0x00b3ff,
    backgroundColor: 0xff0000
  },
  {
    diffMultiplier: 0.8,
    specMultiplier: 0.4,
    pointColor: 0x22b591,
    scatterDivider: 67,
    scatterPowInv: 0.6,
    lightColor: 0x41b5ce,
    backgroundColor: 0x07313a
  },
  {
    diffMultiplier: 0.3,
    specMultiplier: 0.8,
    pointColor: 0xffffff,
    scatterDivider: 80,
    scatterPowInv: 0.5,
    lightColor: 0xff4b86,
    backgroundColor: 0x16c6e9
  }
]
