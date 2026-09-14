import { describe, it, expect } from 'vitest'
import {
  CLIP_IDLE,
  CLIP_DRAW,
  CLIP_SMASH,
  CLIP_STORM,
  createCharacterAnimator
} from '../source/js/landing-bg/character/animator.js'

describe('character animator contract', () => {
  it('exports clip names', () => {
    expect(CLIP_IDLE).toBe('idle_fly')
    expect(CLIP_DRAW).toBe('skill_draw')
    expect(CLIP_SMASH).toBe('skill_smash')
    expect(CLIP_STORM).toBe('skill_storm')
  })

  it('exports createCharacterAnimator', () => {
    expect(typeof createCharacterAnimator).toBe('function')
  })
})

