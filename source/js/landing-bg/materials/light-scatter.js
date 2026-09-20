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

/** featured 场景配色主题表（与线上 _ 数组一致） */
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

/** 线上 featured 构造默认值（主题插值前） */
export const FEATURED_DEFAULT = {
  diffMultiplier: 0.45,
  specMultiplier: 1,
  pointColor: 0xffffff,
  scatterDivider: 150,
  scatterPowInv: 0.4,
  lightColor: 0x00b3ff,
  backgroundColor: 0x060606,
  lightDistance: 9
}

/**
 * 线上：g += 0.1 * (scrollTop - g)，再按主题表插值。
 * 滚动时颜色在变，静止时落到 scrollTop 对应主题。
 */
export function createFeaturedThemeSampler (initialScroll = 0) {
  let g = initialScroll
  const mix = (x, y, t) => x + (y - x) * t
  const mixHex = (a, b, t) => {
    const ar = (a >> 16) & 255
    const ag = (a >> 8) & 255
    const ab = a & 255
    const br = (b >> 16) & 255
    const bg = (b >> 8) & 255
    const bb = b & 255
    const r = Math.round(mix(ar, br, t))
    const gch = Math.round(mix(ag, bg, t))
    const bv = Math.round(mix(ab, bb, t))
    return (r << 16) | (gch << 8) | bv
  }
  return {
    sample (scrollTop) {
      g += 0.1 * (scrollTop - g)
      const n = Math.max(0, g)
      const len = FEATURED_THEMES.length
      const a = FEATURED_THEMES[Math.floor(n) % len]
      const b = FEATURED_THEMES[Math.ceil(n) % len]
      const t = n % 1
      return {
        diffMultiplier: mix(a.diffMultiplier, b.diffMultiplier, t),
        specMultiplier: mix(a.specMultiplier, b.specMultiplier, t),
        pointColor: mixHex(a.pointColor, b.pointColor, t),
        scatterDivider: mix(a.scatterDivider, b.scatterDivider, t),
        scatterPowInv: mix(a.scatterPowInv, b.scatterPowInv, t),
        lightColor: mixHex(a.lightColor, b.lightColor, t),
        backgroundColor: mixHex(a.backgroundColor, b.backgroundColor, t),
        lightDistance: 9
      }
    }
  }
}
