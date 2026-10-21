import { Check } from 'lucide-react'

const SEGMENT_COUNT = 10
const DEFAULT_SIZE = 18
const STROKE_WIDTH = 1
/** Smaller gap = wider dashes. */
const GAP_DEGREES = 9

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDegrees: number,
) {
  const radians = (angleDegrees * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  }
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(cx, cy, radius, endAngle)
  const end = polarToCartesian(cx, cy, radius, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

/** How many of 10 dashes are filled for a given progress (0–99). */
export function filledProgressSegments(progress: number): number {
  const clamped = Math.min(99, Math.max(0, progress))
  return Math.min(SEGMENT_COUNT, Math.floor(clamped / 10))
}

export function ProgressDot({
  progress,
  size = DEFAULT_SIZE,
}: {
  progress: number
  size?: number
}) {
  if (progress >= 100) {
    return (
      <span
        className="grid place-items-center rounded-full bg-orange-700 text-white"
        style={{ width: size, height: size }}
      >
        <Check className="size-3 stroke-[3]" aria-hidden />
      </span>
    )
  }

  const filled = filledProgressSegments(progress)
  const radius = (size - STROKE_WIDTH) / 2
  const cx = size / 2
  const cy = size / 2
  const step = 360 / SEGMENT_COUNT
  const sweep = step - GAP_DEGREES

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
      aria-hidden
      data-filled={filled}
    >
      {Array.from({ length: SEGMENT_COUNT }, (_, index) => {
        const startAngle = index * step
        const endAngle = startAngle + sweep
        return (
          <path
            key={index}
            d={describeArc(cx, cy, radius, startAngle, endAngle)}
            fill="none"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="butt"
            className={
              index < filled ? 'stroke-orange-700' : 'stroke-orange-300'
            }
          />
        )
      })}
    </svg>
  )
}
