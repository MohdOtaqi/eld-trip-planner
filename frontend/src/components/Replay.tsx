import { ChevronDown, Pause, Play } from 'lucide-react'
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { Clocks, TripPlan } from '../lib/api'
import { formatDay, formatTime } from '../lib/format'
import { CLOCK_LIMITS, momentAt } from '../lib/replay'
import { KINDS, STATUSES } from '../lib/stops'

const CLOCKS: { key: keyof Clocks; label: string }[] = [
  { key: 'break', label: 'Break' },
  { key: 'drive', label: 'Drive' },
  { key: 'shift', label: 'Shift' },
  { key: 'cycle', label: 'Cycle' },
]

interface Props {
  plan: TripPlan
  minute: number
  onChange: Dispatch<SetStateAction<number>>
}

export function Replay({ plan, minute, onChange }: Props) {
  const [playing, setPlaying] = useState(false)
  const duration = plan.summary.duration_minutes
  const { event, next, time, clocks } = momentAt(plan, minute)

  useEffect(() => {
    if (!playing) return
    // The whole trip plays back in roughly 25 seconds, whatever its length.
    const minutesPerMs = duration / 25_000
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const step = (now - last) * minutesPerMs
      last = now
      onChange((current) => Math.min(current + step, duration))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, duration, onChange])

  const finished = minute >= duration
  if (playing && finished) setPlaying(false)

  const toggle = () => {
    if (finished) onChange(0)
    setPlaying(!playing)
  }

  const activity =
    event.kind === 'drive' ? `Driving to ${next?.place ?? event.place}` : `${KINDS[event.kind].label}, ${event.place}`

  return (
    <div className="on-dark border-asphalt-700 bg-asphalt-900/92 px-4 py-3 text-asphalt-100 backdrop-blur-md lg:rounded-md lg:border lg:shadow-2xl lg:shadow-black/50">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause trip replay' : 'Play trip replay'}
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-lane text-asphalt-950 hover:brightness-105"
        >
          {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </button>

        <div className="min-w-0 flex-1 basis-44">
          <p className="text-[15px] font-bold tabular-nums leading-tight text-white">
            {formatDay(time)}, {formatTime(time)}
          </p>
          <p className="flex items-center gap-2 truncate text-[13px] text-asphalt-300">
            <span className="size-2 shrink-0 rounded-full" style={{ background: STATUSES[event.status].color }} />
            <span className="truncate">{activity}</span>
          </p>
        </div>

        <ul className="flex gap-3" aria-label="Hours left on each clock">
          {CLOCKS.map(({ key, label }) => (
            <Clock key={key} label={label} minutes={clocks[key]} limit={CLOCK_LIMITS[key]} />
          ))}
        </ul>

        <a
          href="#logs"
          className="hidden h-10 items-center gap-1.5 rounded-md bg-white/10 pl-4 pr-3 text-sm font-semibold text-white hover:bg-white/16 sm:inline-flex"
        >
          Daily logs
          <ChevronDown size={17} strokeWidth={2.4} />
        </a>
      </div>

      <div className="relative mt-3 h-5">
        <div className="absolute inset-x-0 top-1.5 flex h-2 overflow-hidden rounded-full" aria-hidden>
          {plan.events.map((item) => (
            <span
              key={item.start}
              style={{ flexGrow: item.minutes, flexBasis: 0, background: STATUSES[item.status].color }}
            />
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={duration}
          step={1}
          value={Math.round(minute)}
          aria-label="Trip time"
          aria-valuetext={`${formatDay(time)}, ${formatTime(time)}, ${activity}`}
          onChange={(input) => {
            setPlaying(false)
            onChange(Number(input.target.value))
          }}
          className="scrubber absolute inset-0 w-full"
        />
      </div>
    </div>
  )
}

function Clock({ label, minutes, limit }: { label: string; minutes: number; limit: number }) {
  const rounded = Math.max(Math.round(minutes), 0)
  const low = rounded <= 30
  return (
    <li className="flex flex-col items-center gap-0.5">
      <span className="relative grid size-12 place-items-center">
        <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx={20} cy={20} r={17} fill="none" stroke="var(--color-asphalt-700)" strokeWidth={3.5} />
          <circle
            cx={20}
            cy={20}
            r={17}
            fill="none"
            stroke={low ? 'var(--color-stop)' : 'var(--color-lane)'}
            strokeWidth={3.5}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${(rounded / limit) * 100} 100`}
          />
        </svg>
        <span className="text-[11px] font-bold tabular-nums text-white">
          {Math.floor(rounded / 60)}:{String(rounded % 60).padStart(2, '0')}
        </span>
      </span>
      <span className="text-[11px] text-asphalt-300">{label}</span>
    </li>
  )
}
