import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

  it('calls onSelect when the spanish word is clicked', () => {
    const onSelect = vi.fn<() => void>()
    render(
      <ul>
        <WordRow
          spanish="hola"
          russian="привет"
          progress={60}
          onSelect={onSelect}
        />
      </ul>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'hola' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})
