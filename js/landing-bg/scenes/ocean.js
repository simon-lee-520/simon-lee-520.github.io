import * as THREE from 'three'
import {
  OCEAN_CREATURE_Z_CENTER,
  OCEAN_FISH_Z_FAR,
  OCEAN_FISH_Z_NEAR
} from '../constants.js'
import {
  clampOceanXY,
  lerpOceanX,
  lerpOceanY,
  oceanSpan
} from '../ocean-bounds.js'
import { createMainJellyfish, updateGltfJellyfishMotion } from '../character/jellyfish.js'
import { createJellyfishSilhouette } from './ocean-jelly-procedural.js'
import {
  createFishBodyMaterial,
  tintFishInstanceColors
} from '../materials/fish-lit.js'
import { applyFeaturedParticleToObject } from '../materials/featured-particle-lit.js'
import { updateJellyPulse } from '../materials/jelly-lit.js'
import {
  bindFeaturedBgColorUniform,
  createFeaturedBgMesh,
  createFeaturedSharedUniforms,
  updateFeaturedBg,
  FEATURED_CYAN
} from '../materials/featured-scene.js'
import {
  createFishVolumeGeometry,
  updateJellyTentacleStrands
} from '../geometries/creatures.js'

const FISH_COUNT = 60
const FLOCK_COUNT = 5
const JELLYFISH_COUNT = 5


function fishDepth01 (path, flock) {
  const z =
    flock.zCenter +
    Math.sin(path.offsetPhase) * flock.zAmp * 0.3 +
    path.zJitter
  return THREE.MathUtils.clamp(
    (z - OCEAN_FISH_Z_FAR) / (OCEAN_FISH_Z_NEAR - OCEAN_FISH_Z_FAR),
    0,
    1
  )
}

function createFishSchool (sharedUniforms) {
  const flocks = []
  for (let f = 0; f < FLOCK_COUNT; f++) {
    flocks.push({
      centerNx: 0.12 + Math.random() * 0.76,
      centerNy: 0.1 + Math.random() * 0.8,
      orbitRadiusN: 0.07 + Math.random() * 0.11,
      speed: 0.00085 + Math.random() * 0.00055,
      phase: Math.random() * Math.PI * 2,
      rotOffset: Math.random() * Math.PI * 2,
      zCenter: OCEAN_CREATURE_Z_CENTER + (Math.random() - 0.5) * 6,
      zAmp: 6.5 + Math.random() * 5,
      zPhase: Math.random() * Math.PI * 2,
      zSpeedMult: 0.9 + Math.random() * 0.85
    })
  }

  const paths = []
  const variantCounts = [0, 0]
  let fishLeft = FISH_COUNT

  for (let flockId = 0; flockId < FLOCK_COUNT; flockId++) {
    const inFlock =
      flockId < FLOCK_COUNT - 1
        ? Math.max(8, Math.round(fishLeft / (FLOCK_COUNT - flockId)))
        : fishLeft
    fishLeft -= inFlock

    for (let j = 0; j < inFlock; j++) {
      const schoolIdx = variantCounts[0] <= variantCounts[1] ? 0 : 1
      const depth = 0.35 + Math.random() * 0.65
      const ring = 0.012 + Math.random() * 0.028
      const angle = (j / inFlock) * Math.PI * 2 + (Math.random() - 0.5) * 0.35

      paths.push({
        flockId,
        schoolIdx,
        instanceIdx: variantCounts[schoolIdx]++,
        offsetXn: Math.cos(angle) * ring,
        offsetYn: Math.sin(angle) * ring * 0.72,
        offsetPhase: Math.random() * Math.PI * 2,
        localPhase: Math.random() * Math.PI * 2,
        localSpeedMult: 0.55 + Math.random() * 1.25,
        localRadiusN: 0.016 + Math.random() * 0.034,
        wanderX: Math.random() * Math.PI * 2,
        wanderY: Math.random() * Math.PI * 2,
        headingBase: Math.random() * Math.PI * 2,
        headingRate: 0.00035 + Math.random() * 0.00075,
        headingAmp: 0.8 + Math.random() * 2.1,
        zJitter: (Math.random() - 0.5) * 2.2,
        zWander: 0.6 + Math.random() * 1.4,
        zChaosA: Math.random() * Math.PI * 2,
        zChaosB: Math.random() * Math.PI * 2,
        zChaosC: Math.random() * Math.PI * 2,
        zChaosAmp: 0.8 + Math.random() * 2.2,
        zDrift: (Math.random() - 0.5) * 3,
        zDriftPhase: Math.random() * Math.PI * 2,
        zDriftRate: 0.00045 + Math.random() * 0.0009,
        zDriftAmp: 0.00035 + Math.random() * 0.00055,
        zDriftMax: 4 + Math.random() * 3,
        scaleBase: (0.52 + Math.random() * 0.4) * (0.58 + depth * 0.48),
        length: 0.88 + Math.random() * 0.35
      })
    }
  }

  const geos = [createFishVolumeGeometry(0), createFishVolumeGeometry(1)]
  const schools = geos.map((geometry, variant) => {
    const count = variantCounts[variant]
    const body = new THREE.InstancedMesh(
      geometry,
      createFishBodyMaterial(sharedUniforms),
      count
    )
    body.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    body.frustumCulled = false
    body.renderOrder = 10
    tintFishInstanceColors(body, paths.filter((p) => p.schoolIdx === variant), (p) =>
      fishDepth01(p, flocks[p.flockId])
    )
    return { body, count, variant }
  })

  return { schools, paths, flocks }
}

function setJellyPosition (jelly, x, y) {
  const clamped = clampOceanXY(x, y)
  jelly.position.set(clamped.x, clamped.y, jelly.userData.planeZ)
}

function jellyPosFromNorm (nx, ny) {
  return {
    x: lerpOceanX(nx),
    y: lerpOceanY(ny)
  }
}

/** featured 背景平面 mesh */
function createFeaturedOceanBackdrop (sharedUniforms) {
  const mesh = createFeaturedBgMesh(sharedUniforms)
  bindFeaturedBgColorUniform(sharedUniforms, mesh)
  mesh.userData.noSceneBlend = true
  return mesh
}

export function createOceanFeaturedUniforms (cameraPosition, mouse3) {
  return createFeaturedSharedUniforms(cameraPosition, mouse3)
}

export function createOceanScene ({ cameraPosition, mouse3, sharedUniforms } = {}) {
  const group = new THREE.Group()

  const camPos = cameraPosition ?? new THREE.Vector3()
  const mouse = mouse3 ?? new THREE.Vector3()
  const shared = sharedUniforms ?? createFeaturedSharedUniforms(camPos, mouse)

  const backdrop = createFeaturedOceanBackdrop(shared)
  group.add(backdrop)

  const { schools: fishSchools, paths: fishPaths, flocks: fishFlocks } =
    createFishSchool(shared)
  for (const school of fishSchools) {
    group.add(school.body)
  }

  const jellyfish = []
  for (let i = 0; i < JELLYFISH_COUNT; i++) {
    const jelly = i === 0 ? createMainJellyfish(shared) : createJellyfishSilhouette(false, i)
    const drift = jellyPosFromNorm(jelly.userData.driftN.x, jelly.userData.driftN.y)
    setJellyPosition(jelly, drift.x, drift.y)
    applyFeaturedParticleToObject(jelly, shared)
    group.add(jelly)
    jellyfish.push(jelly)
  }

  const mainJelly = jellyfish[0]
  const dummy = new THREE.Object3D()
  const followPos = new THREE.Vector3()

  return {
    group,
    backdrop,
    sharedUniforms: shared,
    update (followTarget, elapsed, delta, _lightState, camera) {
      const tSec = elapsed * 0.001

      if (camera) updateFeaturedBg(shared, camera, FEATURED_CYAN)

      const span = oceanSpan()
      const dt = delta || 16

      const orbitScale = Math.min(span.width, span.height)

      for (const p of fishPaths) {
        const school = fishSchools[p.schoolIdx]
        const flock = fishFlocks[p.flockId]
        const t = elapsed * flock.speed + flock.phase
        const cx = lerpOceanX(flock.centerNx)
        const cy = lerpOceanY(flock.centerNy)
        const orbit = orbitScale * flock.orbitRadiusN
        const schoolX = cx + Math.cos(t) * orbit
        const schoolY = cy + Math.sin(t * 0.85) * orbit * 0.72
        const lt = elapsed * flock.speed * p.localSpeedMult + p.localPhase
        const pack = 1 + Math.sin(t * 1.6 + p.offsetPhase) * 0.05
        const ox = p.offsetXn * span.width * pack
        const oy = p.offsetYn * span.height * pack
        const localX =
          Math.cos(lt * 1.22 + p.wanderX) * p.localRadiusN * span.width
        const localY =
          Math.sin(lt * 1.48 + p.wanderY) * p.localRadiusN * span.height
        const tz = elapsed * flock.speed * flock.zSpeedMult + flock.zPhase
        if (!Number.isFinite(p.zDrift)) p.zDrift = 0
        p.zDrift +=
          Math.sin(elapsed * p.zDriftRate + p.zDriftPhase) * p.zDriftAmp * dt
        p.zDrift = THREE.MathUtils.clamp(p.zDrift, -p.zDriftMax, p.zDriftMax)
        let z = THREE.MathUtils.clamp(
          flock.zCenter +
            p.zDrift +
            Math.sin(tz) * flock.zAmp +
            Math.sin(tz * 2.37 + p.zChaosA) * p.zChaosAmp +
            Math.sin(lt * 3.11 + p.zChaosB) * p.zWander +
            Math.sin(tz * 0.61 + p.zChaosC) * flock.zAmp * 0.38 +
            p.zJitter,
          OCEAN_FISH_Z_FAR,
          OCEAN_FISH_Z_NEAR
        )
        if (!Number.isFinite(z)) z = OCEAN_CREATURE_Z_CENTER
        dummy.position.set(schoolX + ox + localX, schoolY + oy + localY, z)

        const ltAhead = lt + 0.12
        const vx =
          Math.cos(ltAhead * 1.22 + p.wanderX) -
          Math.cos(lt * 1.22 + p.wanderX)
        const vy =
          Math.sin(ltAhead * 1.48 + p.wanderY) -
          Math.sin(lt * 1.48 + p.wanderY)
        const fromMotion =
          Math.abs(vx) + Math.abs(vy) > 1e-5 ? Math.atan2(vx, -vy) : p.headingBase
        const fromWander =
          p.headingBase +
          Math.sin(elapsed * p.headingRate + p.offsetPhase) * p.headingAmp
        dummy.rotation.y = fromMotion * 0.55 + fromWander * 0.45
        const swim = lt * 2.2 + p.offsetPhase
        const tailWag = Math.sin(swim) * 0.04
        dummy.rotation.z =
          Math.sin(fromMotion + flock.rotOffset) * 0.03 + tailWag
        dummy.rotation.x = Math.sin(lt * 2.2 + p.localPhase) * 0.02
        const s = p.scaleBase
        dummy.scale.set(s * p.length, s, s)
        dummy.updateMatrix()
        school.body.setMatrixAt(p.instanceIdx, dummy.matrix)
      }
      for (const school of fishSchools) {
        school.body.instanceMatrix.needsUpdate = true
      }

      for (const jelly of jellyfish) {
        const phase = jelly.userData.phase
        const base = jelly.userData.baseScale ?? 1
        const pulse = Math.sin(tSec * 0.85 + phase)

        if (jelly.userData.isGltf) {
          jelly.scale.setScalar(base)
          updateGltfJellyfishMotion(jelly, tSec, phase, pulse)
          jelly.rotation.z = Math.sin(tSec * 0.55 + phase) * 0.022
          jelly.rotation.x = Math.sin(tSec * 0.45 + phase * 1.1) * 0.012
        } else {
          const expand = 1 + pulse * 0.025
          const contract = 1 - pulse * 0.018
          jelly.scale.set(base * expand, base * contract, base * expand)
          jelly.rotation.z = Math.sin(tSec * 0.55 + phase) * 0.025
          jelly.rotation.x = Math.sin(tSec * 0.45 + phase * 1.1) * 0.015
          updateJellyPulse(jelly, pulse * 0.5)
          if (jelly.userData.tentacleStrands) {
            updateJellyTentacleStrands(
              jelly.userData.tentacleStrands,
              tSec,
              phase,
              Math.floor(elapsed / 16)
            )
          }
        }

        if (jelly.userData.mixer) {
          jelly.userData.mixer.update(dt * 0.001)
        }
      }

      const driftAmpX = span.width * 0.04
      const driftAmpY = span.height * 0.03

      for (let i = 1; i < jellyfish.length; i++) {
        const jelly = jellyfish[i]
        const base = jelly.userData.driftN
        const phase = jelly.userData.phase
        const home = jellyPosFromNorm(base.x, base.y)
        setJellyPosition(
          jelly,
          home.x + Math.sin(tSec * 0.7 + phase) * driftAmpX,
          home.y + Math.sin(tSec * 0.55 + phase * 1.3) * driftAmpY
        )
        jelly.rotation.y = Math.sin(tSec * 0.4 + phase) * 0.2
      }

      if (followTarget) {
        const clamped = clampOceanXY(followTarget.x, followTarget.y)
        const mainPhase = mainJelly.userData.phase
        const wanderAmpX = span.width * 0.034
        const wanderX =
          Math.sin(tSec * 0.55 + mainPhase) * wanderAmpX +
          Math.sin(tSec * 0.88 + mainPhase * 1.6) * wanderAmpX * 0.38
        const wanderY = Math.sin(tSec * 1.1 + mainPhase * 0.7) * span.height * 0.006
        followPos.set(
          clamped.x + wanderX,
          clamped.y + wanderY,
          OCEAN_CREATURE_Z_CENTER
        )
        const lerpFactor = Math.min(1, dt * 0.0022)
        mainJelly.position.lerp(followPos, lerpFactor)
        mainJelly.position.z = OCEAN_CREATURE_Z_CENTER
        const clampedPos = clampOceanXY(mainJelly.position.x, mainJelly.position.y)
        mainJelly.position.x = clampedPos.x
        mainJelly.position.y = clampedPos.y
        mainJelly.rotation.y = Math.sin(tSec * 0.42 + mainPhase) * 0.16
      } else {
        const base = mainJelly.userData.driftN
        const home = jellyPosFromNorm(base.x, base.y)
        setJellyPosition(
          mainJelly,
          home.x + Math.sin(tSec * 0.5) * driftAmpX,
          home.y + Math.sin(tSec * 0.8) * driftAmpY
        )
      }

    }
  }
}
