import { describe, expect, it } from 'vitest'
import { applyProgressChange, progressDelta } from './progress.js'

describe('progressDelta', () => {
  it('maps error counts to deltas', () => {
    expect(progressDelta(0)).toBe(20)
    expect(progressDelta(1)).toBe(10)
    expect(progressDelta(2)).toBe(-10)
    expect(progressDelta(3)).toBe(-20)
    expect(progressDelta(10)).toBe(-20)
  })
})

describe('applyProgressChange', () => {
  it('clamps to 0–100', () => {
    expect(applyProgressChange(90, 0)).toEqual({ delta: 20, newProgress: 100 })
    expect(applyProgressChange(95, 1)).toEqual({ delta: 10, newProgress: 100 })
    expect(applyProgressChange(5, 2)).toEqual({ delta: -10, newProgress: 0 })
    expect(applyProgressChange(10, 3)).toEqual({ delta: -20, newProgress: 0 })
    expect(applyProgressChange(0, 5)).toEqual({ delta: -20, newProgress: 0 })
  })
})
