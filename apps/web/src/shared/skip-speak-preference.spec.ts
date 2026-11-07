import { afterEach, describe, expect, it } from 'vitest'
import {
  clearSkipSpeakExercises,
  readSkipSpeakExercises,
  writeSkipSpeakExercises,
} from './skip-speak-preference'

afterEach(() => {
  clearSkipSpeakExercises()
})

describe('skip speak preference', () => {
  it('defaults to false and round-trips through sessionStorage', () => {
    expect(readSkipSpeakExercises()).toBe(false)
    writeSkipSpeakExercises(true)
    expect(readSkipSpeakExercises()).toBe(true)
    clearSkipSpeakExercises()
    expect(readSkipSpeakExercises()).toBe(false)
  })
})
