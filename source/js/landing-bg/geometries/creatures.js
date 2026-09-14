import * as THREE from 'three'
import { JELLY_PROPORTIONS, jellyMetrics } from '../materials/jelly-appearance.js'
import {
  bindStrandAlongAttribute,
  createJellyStrandMaterial
} from '../materials/jelly-lit.js'

const _pt = new THREE.Vector3()
const _n = new THREE.Vector3()
const _b = new THREE.Vector3()
const _v = new THREE.Vector3()

/** 沿 X 轴（吻→尾）的半截面半径，旋转成流线鱼体 */
function fishRadiusAt (t, variant) {
  const wide = variant === 0 ? 1.14 : 1
  if (t < 0.1) return (0.014 + t * 0.42) * wide
  if (t < 0.48) {
    const u = (t - 0.1) / 0.38
    return (0.052 + Math.sin(u * Math.PI) * 0.036) * wide
  }
  if (t < 0.78) return (0.076 - (t - 0.48) * 0.14) * wide
  return Math.max(0.005, (0.034 - (t - 0.78) * 0.16)) * wide
}

/** 鱼体：Lathe 旋转体，侧扁、尾渐细 */
export function createFishVolumeGeometry (variant) {
  const profile = []
  const length = variant === 1 ? 0.82 : 0.68
  const steps = 22
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = (t - 0.5) * length
    const r = fishRadiusAt(t, variant) * 0.92
    profile.push(new THREE.Vector2(r, x))
  }
  const geo = new THREE.LatheGeometry(profile, 16)
  geo.rotateZ(-Math.PI / 2)
  geo.scale(1, 1, 0.78)
  geo.computeVertexNormals()
  return geo
}

/** 水母伞盖：偏高穹顶（非扁盘）+ 伞缘扇贝褶皱 */
export function createJellyBellGeometry (bellScale = 1) {
  const { H, R, marginY } = jellyMetrics(bellScale)
  const scallopAmp = JELLY_PROPORTIONS.scallopAmp
  const profile = []
  const steps = 22
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const angle = t * Math.PI * 0.5
    const y = marginY + Math.cos(angle) * H
    const scallop = 1 + scallopAmp * Math.sin(t * Math.PI * 11)
    const r = Math.sin(angle) * R * scallop
    profile.push(new THREE.Vector2(Math.max(r, 0.002), y))
  }
  const geo = new THREE.LatheGeometry(profile, 32)
  geo.computeVertexNormals()
  return geo
}

/** 伞内凝胶层（略小，背向渲染） */
export function createJellyBellInnerGeometry (bellScale = 1) {
  const { H, R, marginY } = jellyMetrics(bellScale)
  const p = JELLY_PROPORTIONS
  const profile = []
  const steps = 16
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const angle = t * Math.PI * 0.48
    const y = marginY + Math.cos(angle) * H * p.innerHeightRatio
    const r = Math.sin(angle) * R * p.innerRadiusRatio
    profile.push(new THREE.Vector2(Math.max(r, 0.002), y))
  }
  const geo = new THREE.LatheGeometry(profile, 24)
  geo.computeVertexNormals()
  return geo
}

/** 胃囊 / 发光核（位于伞腔上段） */
export function createJellyCoreGeometry (bellScale = 1) {
  const { coreRadius } = jellyMetrics(bellScale)
  const geo = new THREE.SphereGeometry(coreRadius, 18, 14)
  geo.scale(1, 0.62, 1)
  return geo
}

/** 锥形细丝几何：根部略粗、梢端极细 */
function createTaperedStrandGeometry (curve, tubularSegments, radialSegments, rBase, rTip) {
  const frames = curve.computeFrenetFrames(tubularSegments, false)
  const vertCount = (tubularSegments + 1) * (radialSegments + 1)
  const positions = new Float32Array(vertCount * 3)
  const indices = []

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments
    const r = THREE.MathUtils.lerp(rBase, rTip, t * t * t)
    curve.getPointAt(t, _pt)
    _n.copy(frames.normals[i])
    _b.copy(frames.binormals[i])

    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2
      const cos = Math.cos(theta)
      const sin = Math.sin(theta)
      _v
        .copy(_pt)
        .addScaledVector(_n, r * cos)
        .addScaledVector(_b, r * sin)
      const idx = (i * (radialSegments + 1) + j) * 3
      positions[idx] = _v.x
      positions[idx + 1] = _v.y
      positions[idx + 2] = _v.z
    }
  }

  const row = radialSegments + 1
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * row + j
      const b = a + 1
      const c = a + row
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}


/** 蓬松口腕：短而鼓，垂于伞下中央 */
function buildFrillyOralRestPoints (angle, metrics, length, frillId) {
  const points = []
  const segs = 11
  const { marginY, oralHubR, oralBulge } = metrics
  const frillSeed = frillId * 2.4
  const perpX = Math.cos(angle + Math.PI / 2)
  const perpZ = Math.sin(angle + Math.PI / 2)

  for (let j = 0; j <= segs; j++) {
    const along = j / segs
    const hang = Math.pow(along, 1.08) * length
    const bulge = Math.sin(along * Math.PI) * oralBulge
    const hubR = oralHubR + bulge
    const frill =
      Math.sin(along * Math.PI * 9 + frillSeed) * oralBulge * 0.48 * (1 - along * 0.35) +
      Math.sin(along * Math.PI * 14 + frillSeed * 1.3) * oralBulge * 0.22 * (1 - along * 0.5)
    points.push(
      new THREE.Vector3(
        Math.cos(angle) * hubR + perpX * frill,
        marginY - hang,
        Math.sin(angle) * hubR + perpZ * frill
      )
    )
  }
  return points
}

/** 缘触手：自伞缘垂下的细长发丝 */
function buildMarginalRestPoints (angle, metrics, length, rimJitter) {
  const points = []
  const segs = 10
  const { marginY, marginalRimR, R } = metrics
  const rimR = marginalRimR + rimJitter * R * 0.04
  for (let j = 0; j <= segs; j++) {
    const along = j / segs
    const hang = along * length
    const drift = along * along * R * 0.08
    points.push(
      new THREE.Vector3(
        Math.cos(angle) * (rimR + drift),
        marginY - hang,
        Math.sin(angle) * (rimR + drift)
      )
    )
  }
  return points
}

function createStrand (opts) {
  const {
    kind,
    restPoints,
    rBase,
    rTip,
    tubularSegments,
    radialSegments,
    material,
    waveAmp,
    waveSpeed,
    phase
  } = opts

  const livePoints = restPoints.map((p) => p.clone())
  const curve = new THREE.CatmullRomCurve3(livePoints)
  const geo = createTaperedStrandGeometry(
    curve,
    tubularSegments,
    radialSegments,
    rBase,
    rTip
  )
  bindStrandAlongAttribute(geo, tubularSegments)
  const mesh = new THREE.Mesh(geo, material)
  mesh.renderOrder = 2

  return {
    mesh,
    kind,
    restPoints,
    livePoints,
    curve,
    rBase,
    rTip,
    tubularSegments,
    radialSegments,
    waveAmp,
    waveSpeed,
    phase,
    waveLen: kind === 'oral' ? 3.8 : 6.2,
    crossAmp: kind === 'oral' ? 0.018 : 0.026,
    updateSlot: Math.floor(Math.random() * 3)
  }
}

function rebuildStrandGeometry (strand) {
  strand.curve.points = strand.livePoints
  const prev = strand.mesh.geometry
  const geo = createTaperedStrandGeometry(
    strand.curve,
    strand.tubularSegments,
    strand.radialSegments,
    strand.rBase,
    strand.rTip
  )
  bindStrandAlongAttribute(geo, strand.tubularSegments)
  strand.mesh.geometry = geo
  prev.dispose()
}

function sampleStrandPoints (strand, tSec, jellyPhase) {
  const { restPoints, livePoints, waveAmp, waveSpeed, phase, waveLen, crossAmp } =
    strand
  const segs = restPoints.length - 1
  for (let j = 0; j <= segs; j++) {
    const along = j / segs
    const base = restPoints[j]
    const lag = jellyPhase - along * 0.55
    const wave =
      Math.sin(tSec * waveSpeed + lag + phase + along * waveLen) *
      waveAmp *
      along
    const cross =
      Math.cos(tSec * waveSpeed * 0.82 + lag + phase * 1.1 + along * 3.6) *
      crossAmp *
      along
    livePoints[j].set(base.x + wave, base.y, base.z + cross)
  }
}

/** 口腕中心蓬松云雾（参考图胃囊周围絮状结构） */
export function createJellyOralCloud (bellScale, isMain, look, cloudMaterial) {
  const root = new THREE.Group()
  const metrics = jellyMetrics(bellScale)
  const count = isMain ? 16 : 10
  const baseGeo = new THREE.SphereGeometry(1, 10, 8)

  for (let i = 0; i < count; i++) {
    const s = metrics.oralHubR * (0.35 + (i % 5) * 0.12)
    const mesh = new THREE.Mesh(baseGeo, cloudMaterial)
    const angle = (i / count) * Math.PI * 2 + i * 0.37
    const r = metrics.oralHubR * (0.15 + (i % 4) * 0.18)
    mesh.position.set(
      Math.cos(angle) * r,
      metrics.marginY - metrics.oralLen * (0.08 + (i % 3) * 0.12),
      Math.sin(angle) * r
    )
    const squash = 0.55 + (i % 3) * 0.15
    mesh.scale.set(s * (0.9 + (i % 2) * 0.2), s * squash, s * (0.85 + (i % 2) * 0.15))
    mesh.renderOrder = 1
    root.add(mesh)
  }
  return root
}

/** 口腕簇（中央褶边）+ 缘毛（伞缘细丝） */
export function createJellyTentacleSystem (bellScale, isMain, look) {
  const root = new THREE.Group()
  const strands = []
  const metrics = jellyMetrics(bellScale)
  const p = JELLY_PROPORTIONS
  const oralMat = createJellyStrandMaterial(look, isMain, 'oral')
  const marginalMat = createJellyStrandMaterial(look, isMain, 'marginal')

  const oralLen = metrics.oralLen * (isMain ? 1 : 0.88)
  let frillId = 0
  for (let i = 0; i < p.oralArms; i++) {
    const baseAngle = (i / p.oralArms) * Math.PI * 2
    for (let f = 0; f < p.oralFilaments; f++) {
      const angle = baseAngle + (f - 0.5) * 0.24
      const rest = buildFrillyOralRestPoints(angle, metrics, oralLen, frillId++)
      const strand = createStrand({
        kind: 'oral',
        restPoints: rest,
        rBase: metrics.oralHubR * (isMain ? 1.2 : 1.0),
        rTip: metrics.oralHubR * 0.12,
        tubularSegments: 12,
        radialSegments: 6,
        material: oralMat,
        waveAmp: metrics.H * 0.05,
        waveSpeed: 0.68 + i * 0.05 + f * 0.03,
        phase: i * 1.1 + f * 0.7
      })
      root.add(strand.mesh)
      strands.push(strand)
    }
  }

  const marginalCount = isMain ? p.marginalCountMain : p.marginalCountBg
  const marginalLen = metrics.marginalLen * (isMain ? 1 : 0.9)
  for (let i = 0; i < marginalCount; i++) {
    const angle =
      (i / marginalCount) * Math.PI * 2 + ((i % 3) - 1) * 0.04
    const rimJitter = ((i * 0.17) % 1) * 0.06 - 0.03
    const lenJitter = 0.9 + ((i * 0.31) % 1) * 0.18
    const rest = buildMarginalRestPoints(
      angle,
      metrics,
      marginalLen * lenJitter,
      rimJitter
    )
    const strand = createStrand({
      kind: 'marginal',
      restPoints: rest,
      rBase: metrics.R * (isMain ? 0.011 : 0.009),
      rTip: metrics.R * 0.0004,
      tubularSegments: 12,
      radialSegments: 3,
      material: marginalMat,
      waveAmp: metrics.H * 0.065,
      waveSpeed: 0.95 + (i % 5) * 0.08,
      phase: i * 0.55
    })
    root.add(strand.mesh)
    strands.push(strand)
  }

  return { root, strands, metrics }
}

/** 触手飘动：沿长度传播的正弦波，交错重建几何 */
export function updateJellyTentacleStrands (strands, tSec, jellyPhase, frameSeed) {
  if (!strands?.length) return
  for (let i = 0; i < strands.length; i++) {
    const strand = strands[i]
    if ((frameSeed + strand.updateSlot + i) % 3 !== 0) continue
    sampleStrandPoints(strand, tSec, jellyPhase)
    rebuildStrandGeometry(strand)
  }
}
