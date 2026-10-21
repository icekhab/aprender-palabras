/** Progress delta for one card after a finished trainer (§3 daily training). */
export function progressDelta(errorCount: number): number {
  if (errorCount <= 0) {
    return 50
  }
  if (errorCount === 1) {
    return 30
  }
  if (errorCount === 2) {
    return 10
  }
  return -10
}

export function clampProgress(value: number): number {
  return Math.min(100, Math.max(0, value))
}

export function applyProgressChange(
  oldProgress: number,
  errorCount: number,
): { delta: number; newProgress: number } {
  const delta = progressDelta(errorCount)
  return {
    delta,
    newProgress: clampProgress(oldProgress + delta),
  }
}
