import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  BOUNDARY_12_VH,
  BOUNDARY_23_VH,
  BLEND_HALF_VH
} from '../source/js/landing-bg/constants.js'
import {
  computeScrollState,
  getDesignMaxScroll
} from '../source/js/landing-bg/scroll-director.js'

describe('scroll-director', () => {
  const originalWindow = globalThis.window

  beforeAll(() => {
    globalThis.window = { innerHeight: 1000 }
  })

  afterAll(() => {
    globalThis.window = originalWindow
  })

  const vhPx = 1000 / 100
  const scrollAt = (vh) => vh * vhPx

  it('blend boundaries + actIndex transitions', () => {
    expect(computeScrollState(scrollAt(0)).blend12).toBe(0)
    expect(computeScrollState(getDesignMaxScroll()).blend23).toBe(1)

    expect(computeScrollState(scrollAt(BOUNDARY_12_VH - BLEND_HALF_VH - 1)).blend12).toBeLessThan(1)
    expect(computeScrollState(scrollAt(BOUNDARY_12_VH + BLEND_HALF_VH + 1)).blend12).toBeGreaterThan(0)

    expect(computeScrollState(scrollAt(BOUNDARY_23_VH - 1)).actIndex).toBe(2)
    expect(computeScrollState(scrollAt(BOUNDARY_23_VH + BLEND_HALF_VH + 1)).actIndex).toBe(3)
  })
})

