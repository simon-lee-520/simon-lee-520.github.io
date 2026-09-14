import * as THREE from 'three'
import { SKILL_COOLDOWN_MS, PALETTE } from '../constants.js'
import { CLIP_DRAW, CLIP_SMASH, CLIP_STORM } from './animator.js'

function animate (durationMs, update) {
  return new Promise((resolve) => {
    const start = performance.now()
    function frame (now) {
      const t = Math.min((now - start) / durationMs, 1)
      update(t)
      if (t < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
}

function disposeObject (obj) {
  if (obj.children?.length) {
    for (const child of [...obj.children]) disposeObject(child)
  }
  obj.parent?.remove(obj)
  obj.geometry?.dispose()
  const mat = obj.material
  if (mat) {
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
    else mat.dispose()
  }
}

async function skillDraw ({ swordsmanGroup, scene }) {
  const worldPos = new THREE.Vector3()
  swordsmanGroup.getWorldPosition(worldPos)
  const sword = swordsmanGroup.getObjectByName('Sword')
  const blade = sword?.userData?.blade ?? sword?.children?.[0]
  const origIntensity = blade?.material?.emissiveIntensity ?? null

  const slash = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 0.22),
    new THREE.MeshBasicMaterial({
      color: PALETTE.neonCyan,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  )
  slash.position.set(worldPos.x - 1.2, worldPos.y + 0.35, worldPos.z)
  slash.rotation.set(-0.2, 0.45, 0.1)
  scene.add(slash)

  await animate(600, (t) => {
    slash.position.x = worldPos.x - 1.2 + t * 2.8
    slash.material.opacity = 0.95 * (1 - t * 0.85)
    if (blade?.material?.emissive) {
      const pulse = t < 0.35 ? t / 0.35 : Math.max(0, 1 - (t - 0.35) / 0.4)
      blade.material.emissiveIntensity = 1.2 + pulse * 2.4
    }
  })

  if (blade?.material && origIntensity !== null) {
    blade.material.emissiveIntensity = origIntensity
  }
  disposeObject(slash)
}

async function skillSmash ({ swordsmanGroup, scene }) {
  const worldPos = new THREE.Vector3()
  swordsmanGroup.getWorldPosition(worldPos)

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.75, 64),
    new THREE.MeshBasicMaterial({
      color: PALETTE.neonMagenta,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.set(worldPos.x, worldPos.y - 1.75, worldPos.z)
  scene.add(ring)

  await animate(900, (t) => {
    const ringT = Math.min(t / 0.75, 1)
    const s = 1 + ringT * 8
    ring.scale.set(s, s, 1)
    ring.material.opacity = 0.75 * (1 - ringT)
  })

  disposeObject(ring)
}

async function skillStorm ({ swordsmanGroup, scene }) {
  const worldPos = new THREE.Vector3()
  swordsmanGroup.getWorldPosition(worldPos)

  const pivot = new THREE.Group()
  pivot.position.set(worldPos.x, worldPos.y + 0.5, worldPos.z)
  scene.add(pivot)

  const arcMeshes = []
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(Math.cos(a0) * 0.4, -0.3, Math.sin(a0) * 0.4),
      new THREE.Vector3(Math.cos(a0 + 0.6) * 1.2, 0.5, Math.sin(a0 + 0.6) * 1.2),
      new THREE.Vector3(Math.cos(a0 + 1.1) * 2.0, 0, Math.sin(a0 + 1.1) * 2.0)
    )
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(20)),
      new THREE.LineBasicMaterial({
        color: i % 2 ? PALETTE.neonMagenta : PALETTE.neonCyan,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    )
    pivot.add(line)
    arcMeshes.push(line)
  }

  await animate(1800, (t) => {
    pivot.rotation.y = t * Math.PI * 3
    const fade = t > 0.75 ? (1 - t) / 0.25 : 1
    for (const line of arcMeshes) {
      line.material.opacity = fade
    }
  })

  disposeObject(pivot)
}

const VFX_BY_ID = {
  vfx_draw: (ctx) => skillDraw(ctx),
  vfx_smash: () => Promise.resolve(),
  vfx_smash_ring: (ctx) => skillSmash(ctx),
  vfx_storm: (ctx) => skillStorm(ctx)
}

const CLIP_FOR_VFX = {
  vfx_draw: CLIP_DRAW,
  vfx_smash_ring: CLIP_SMASH,
  vfx_storm: CLIP_STORM
}

export function createSkills ({ swordsmanGroup, scene, postPipeline, swordsman }) {
  let busy = false
  let lastAt = 0

  async function runVfx (id) {
    const fn = VFX_BY_ID[id]
    if (fn) await fn({ swordsmanGroup, scene })
  }

  function triggerRandom () {
    if (busy || Date.now() - lastAt < SKILL_COOLDOWN_MS) return
    if (swordsman?.isSkillBusy?.()) return

    lastAt = Date.now()
    busy = true

    if (swordsman?.triggerRandomSkill?.()) {
      const finish = () => {
        if (!swordsman.isSkillBusy()) {
          busy = false
        } else {
          requestAnimationFrame(finish)
        }
      }
      requestAnimationFrame(finish)
      return
    }

    const picks = [CLIP_DRAW, CLIP_SMASH, CLIP_STORM]
    const pick = picks[Math.floor(Math.random() * picks.length)]
    const legacy = pick === CLIP_DRAW ? skillDraw : pick === CLIP_SMASH ? skillSmash : skillStorm
    legacy({ swordsmanGroup, scene }).finally(() => {
      busy = false
    })
    postPipeline?.pulseBloom?.(0.1, 240)
  }

  return {
    isBusy: () => busy,
    triggerRandom,
    runVfx
  }
}
