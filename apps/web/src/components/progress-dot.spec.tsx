import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { filledProgressSegments, ProgressDot } from './progress-dot'

afterEach(() => {
  cleanup()
})

describe('filledProgressSegments', () => {
  it('maps progress to 0–10 dashes', () => {
    expect(filledProgressSegments(0)).toBe(0)
    expect(filledProgressSegments(9)).toBe(0)
    expect(filledProgressSegments(10)).toBe(1)
    expect(filledProgressSegments(60)).toBe(6)
    expect(filledProgressSegments(95)).toBe(9)
    expect(filledProgressSegments(99)).toBe(9)
  })
})

describe('ProgressDot', () => {
  it('renders ten dashed segments with six filled at 60%', () => {
    const { container } = render(<ProgressDot progress={60} />)

    const ring = container.querySelector('svg[data-filled="6"]')
    expect(ring).toBeTruthy()
    expect(ring?.querySelectorAll('path')).toHaveLength(10)
    expect(ring?.querySelectorAll('path.stroke-orange-700')).toHaveLength(6)
    expect(ring?.querySelectorAll('path.stroke-orange-300')).toHaveLength(4)
  })

  it('renders a checkmark at 100%', () => {
    const { container } = render(<ProgressDot progress={100} />)

    expect(container.querySelector('svg[data-filled]')).toBeNull()
    expect(container.querySelector('svg.lucide-check')).toBeTruthy()
  })
})
