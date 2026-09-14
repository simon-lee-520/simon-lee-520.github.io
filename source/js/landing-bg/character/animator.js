import * as THREE from 'three'

export const CLIP_IDLE = 'idle_fly'
export const CLIP_DRAW = 'skill_draw'
export const CLIP_SMASH = 'skill_smash'
export const CLIP_STORM = 'skill_storm'

const SKILL_CLIPS = [CLIP_DRAW, CLIP_SMASH, CLIP_STORM]

/** 无 clip 时程序化技能时间轴（秒） */
const PROC_SKILL_DUR = {
  [CLIP_DRAW]: 0.65,
  [CLIP_SMASH]: 0.95,
  [CLIP_STORM]: 1.85
}

const VFX_MARKERS = {
  [CLIP_DRAW]: [{ t: 0.32, id: 'vfx_draw' }],
  [CLIP_SMASH]: [{ t: 0.42, id: 'vfx_smash' }, { t: 0.55, id: 'vfx_smash_ring' }],
  [CLIP_STORM]: [{ t: 0.2, id: 'vfx_storm' }]
}

const CROSS_FADE = 0.22

/**
 * @param {object} opts
 * @param {import('@pixiv/three-vrm').VRM} opts.vrm
 * @param {THREE.Object3D} opts.root
 * @param {(id: string, clipName: string) => void} [opts.onVfx]
 * @param {() => void} [opts.onSkillEnd]
 */
export function createCharacterAnimator ({ vrm, root, onVfx, onSkillEnd }) {
  const mixer = new THREE.AnimationMixer(root)
  const actions = new Map()
  let idleAction = null
  let activeSkill = null
  let procSkill = null
  let procElapsed = 0
  let firedMarkers = new Set()

  function findClip (name) {
    const clips = root.animations ?? []
    return clips.find((c) => c.name === name) ||
      clips.find((c) => c.name.toLowerCase() === name.toLowerCase())
  }

  function registerClips () {
    const names = [CLIP_IDLE, ...SKILL_CLIPS]
    for (const name of names) {
      const clip = findClip(name)
      if (!clip) continue
      const action = mixer.clipAction(clip)
      actions.set(name, action)
      if (name === CLIP_IDLE) {
        idleAction = action
        action.setLoop(THREE.LoopRepeat, Infinity)
      } else {
        action.setLoop(THREE.LoopOnce, 1)
        action.clampWhenFinished = true
      }
    }
    if (idleAction) {
      idleAction.reset().fadeIn(CROSS_FADE).play()
    }
    if (actions.size > 0) {
      console.info('[landing-bg] animator clips:', [...actions.keys()])
    }
  }

  registerClips()

  const hasClips = () => actions.size > 0

  function fadeTo (action) {
    if (!action) return
    for (const [, a] of actions) {
      if (a !== action && a.isRunning()) a.fadeOut(CROSS_FADE)
    }
    action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(CROSS_FADE).play()
  }

  function returnToIdle () {
    activeSkill = null
    procSkill = null
    procElapsed = 0
    firedMarkers.clear()
    if (idleAction) fadeTo(idleAction)
    onSkillEnd?.()
  }

  function playSkillClip (name) {
    if (activeSkill) return false
    const action = actions.get(name)
    if (action) {
      activeSkill = name
      firedMarkers.clear()
      fadeTo(action)
      return true
    }
    if (!hasClips()) {
      activeSkill = name
      procSkill = name
      procElapsed = 0
      firedMarkers.clear()
      return true
    }
    return false
  }

  function fireMarkers (name, normTime) {
    const list = VFX_MARKERS[name] ?? []
    for (const m of list) {
      const key = `${name}:${m.id}`
      if (normTime >= m.t && !firedMarkers.has(key)) {
        firedMarkers.add(key)
        onVfx?.(m.id, name)
      }
    }
  }

  function update (deltaSec) {
    if (!hasClips()) {
      if (procSkill) {
        procElapsed += deltaSec
        const dur = PROC_SKILL_DUR[procSkill] ?? 1
        const t = procElapsed / dur
        fireMarkers(procSkill, t)
        if (t >= 1) returnToIdle()
      }
      return
    }

    mixer.update(deltaSec)

    if (activeSkill && activeSkill !== CLIP_IDLE) {
      const action = actions.get(activeSkill)
      if (action) {
        const clip = action.getClip()
        const t = clip.duration > 0 ? action.time / clip.duration : 1
        fireMarkers(activeSkill, t)
        if (action.time >= clip.duration - 0.02) returnToIdle()
      }
    }

    if (vrm) vrm.update(deltaSec)
    if (vrm?.springBoneManager) vrm.springBoneManager.update(deltaSec)
  }

  function isBusy () {
    return activeSkill != null && activeSkill !== CLIP_IDLE
  }

  function pickRandomSkill () {
    return SKILL_CLIPS[Math.floor(Math.random() * SKILL_CLIPS.length)]
  }

  return {
    hasClips,
    update,
    isBusy,
    playSkillClip,
    pickRandomSkill,
    returnToIdle,
    getMixer: () => mixer
  }
}
