import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef } from 'react'

const ROWS = ['Off duty', 'Sleeper berth', 'Driving', 'On duty']
const LEFT = 92
const HOUR = 12.5
const ROW = 22

// A typical day: pre-trip at 6, drive, half-hour break, drive, post-trip, sleeper.
const DAY: [row: number, until: number][] = [
  [0, 6],
  [3, 6.5],
  [2, 12],
  [0, 12.5],
  [2, 17.5],
  [3, 18],
  [1, 24],
]

const path = DAY.map(([row, until], i) => {
  const y = row * ROW + ROW / 2
  return `${i ? 'V' : `M${LEFT},`}${y} H${LEFT + until * HOUR}`
}).join(' ')

export function GridPreview() {
  const svg = useRef<SVGSVGElement>(null)

  useGSAP(
    () => {
      const media = gsap.matchMedia()
      media.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          'path',
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, duration: 2.6, delay: 0.5, ease: 'power1.inOut' },
        )
      })
    },
    { scope: svg },
  )

  return (
    <svg ref={svg} viewBox={`0 0 ${LEFT + 24 * HOUR + 1} ${ROW * 4 + 1}`} className="w-full text-print" aria-hidden>
      {ROWS.map((label, row) => (
        <g key={label}>
          <text x={0} y={row * ROW + 15} fontSize={11} fontWeight={600} fill="currentColor">
            {label}
          </text>
          <rect
            x={LEFT}
            y={row * ROW + 0.5}
            width={24 * HOUR}
            height={ROW}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.8}
          />
          {Array.from({ length: 23 }, (_, i) => (
            <line
              key={i}
              x1={LEFT + (i + 1) * HOUR}
              x2={LEFT + (i + 1) * HOUR}
              y1={row * ROW + 0.5}
              y2={row * ROW + ((i + 1) % 6 ? 7 : ROW)}
              stroke="currentColor"
              strokeWidth={0.6}
            />
          ))}
        </g>
      ))}
      <path
        d={path}
        pathLength={1}
        strokeDasharray={1}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
    </svg>
  )
}
