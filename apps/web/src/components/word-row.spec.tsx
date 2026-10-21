import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { WordRow } from './word-row'

afterEach(() => {
  cleanup()
})

describe('WordRow', () => {
  it('shows ProgressDot for partial progress', () => {
    const { container } = render(
      <ul>
        <WordRow spanish="hola" russian="привет" progress={60} />
      </ul>,
    )

    expect(container.querySelector('svg[data-filled="6"]')).toBeTruthy()
    expect(screen.getByText('hola')).toBeInTheDocument()
  })

  it('shows mastered check via ProgressDot at 100%', () => {
    const { container } = render(
      <ul>
        <WordRow spanish="abrir" russian="открывать" progress={100} />
      </ul>,
    )

    expect(container.querySelector('svg.lucide-check')).toBeTruthy()
  })
})
