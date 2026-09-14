/** 参考图身体比例：伞盖占主体高度约 45–55%，口腕短密，缘毛长而细 */
export const JELLY_PROPORTIONS = {
  bellHeight: 0.55,
  bellRadius: 0.4,
  bellMarginY: 0.005,
  scallopAmp: 0.035,
  innerHeightRatio: 0.8,
  innerRadiusRatio: 0.76,
  coreRadiusRatio: 0.2,
  coreYRatio: 0.72,
  oralLengthRatio: 0.42,
  marginalLengthRatio: 1.18,
  oralHubRadiusRatio: 0.14,
  oralBulgeRatio: 0.28,
  marginalRimRatio: 0.96,
  oralArms: 8,
  oralFilaments: 3,
  marginalCountMain: 42,
  marginalCountBg: 26
}

/** 按 bellScale 计算各部位世界尺寸（+Y 为伞顶） */
export function jellyMetrics (bellScale = 1) {
  const p = JELLY_PROPORTIONS
  const H = p.bellHeight * bellScale
  const R = p.bellRadius * bellScale
  const marginY = p.bellMarginY * bellScale
  const apexY = marginY + H
  return {
    bellScale,
    H,
    R,
    marginY,
    apexY,
    coreY: marginY + H * p.coreYRatio,
    coreRadius: R * p.coreRadiusRatio,
    oralLen: H * p.oralLengthRatio,
    marginalLen: H * p.marginalLengthRatio,
    oralHubR: R * p.oralHubRadiusRatio,
    oralBulge: R * p.oralBulgeRatio,
    marginalRimR: R * p.marginalRimRatio
  }
}

/** 参考图：电青伞缘菲涅尔 + 暖白橙胃囊 + 蓬松口腕云雾 + 细丝缘毛 */
export const JELLY_LOOK_PRESETS = [
  {
    bellColor: 0x082838,
    bellEmissive: 0x1a98b8,
    rim: 0x92eeff,
    coreColor: 0xfffaf2,
    coreEmissive: 0xffc868,
    oralColor: 0xb8e4f4,
    oralEmissive: 0x5ab0d0,
    strandEmissive: 0x48a8c8
  },
  {
    bellColor: 0x082830,
    bellEmissive: 0x1a90b0,
    rim: 0x88f0ff,
    coreColor: 0xfff8ee,
    coreEmissive: 0xffc878,
    oralColor: 0xb0e0f0,
    oralEmissive: 0x52a8c8,
    strandEmissive: 0x42a0c0
  },
  {
    bellColor: 0x082828,
    bellEmissive: 0x1a88a8,
    rim: 0x80f8f0,
    coreColor: 0xfff6ee,
    coreEmissive: 0xffd080,
    oralColor: 0xb4e8e8,
    oralEmissive: 0x50b0b0,
    strandEmissive: 0x4098a8
  }
]
