export const ACT_VH = [200, 160, 150]
export const TOTAL_VH = ACT_VH.reduce((a, b) => a + b, 0) // 510
export const BOUNDARY_12_VH = ACT_VH[0] // 200
export const BOUNDARY_23_VH = ACT_VH[0] + ACT_VH[1] // 360
export const BOUNDARY_12 = BOUNDARY_12_VH / TOTAL_VH
export const BOUNDARY_23 = BOUNDARY_23_VH / TOTAL_VH
export const BLEND_VH = 20
export const BLEND_HALF_VH = BLEND_VH / 2
export const BLEND_HALF = BLEND_HALF_VH / TOTAL_VH

export const MOBILE_MQ = '(max-width: 768px)'
export const SKILL_COOLDOWN_MS = 1200
export const OCEAN_INTERACTIVE_BLEND = 0.85

/** 主水母 / 手电筒所在深度（鱼群与水母群体的 Z 中心） */
export const OCEAN_CREATURE_Z_CENTER = -30
/** 鱼群 Z 范围（近 → 远；保持在背景板 z=-42 之前，近端可越过手电筒 -30） */
export const OCEAN_FISH_Z_NEAR = -20
export const OCEAN_FISH_Z_FAR = -41
/** 手电筒参考深度，鱼可在此前后穿插 */
export const OCEAN_POINTER_Z = OCEAN_CREATURE_Z_CENTER
/** @deprecated 使用 OCEAN_CREATURE_Z_CENTER */
export const OCEAN_JELLY_PLANE_Z = OCEAN_CREATURE_Z_CENTER

/** 主水母相对光标的屏幕偏移（px，正值 = 显示在光标下方，避免挡住指针） */
export const OCEAN_MAIN_JELLY_CURSOR_OFFSET_PX = 72

/** 后处理：参与 bloom 的层 */
export const LAYER_BLOOM = 1

/**
 * 御剑剑客 VRM（VRoid Studio CC0 — AvatarSample_D_Darkness）
 * 首次构建前执行：pnpm run models:swordsman
 */
export const SWORDSMAN_MODEL_URL = '/models/landing/swordsman.vrm'

/**
 * 主水母 glTF（见 source/models/landing/README.md）
 * 文件缺失时自动回退程序化占位
 */
export const JELLYFISH_MODEL_URL = '/models/landing/blue_jellyfish.glb'

export const PALETTE = {
  fogSpace: 0x04060e,
  fogCity: 0x060810,
  /** featured 第 2 幕青色海水 #07313A */
  fogOcean: 0x07313a,
  oceanWater: 0x07313a,
  neonCyan: 0x00f5ff,
  neonMagenta: 0xff2a6d,
  neonViolet: 0x9d4edd,
  starWarm: 0x9a9088,
  starCool: 0xb8c0d0
}
