import type { TripPlan } from '../lib/api'
import { formatDate, formatDuration, formatHours, formatMiles, formatTime } from '../lib/format'

const CYCLE_LIMIT = 70

export function TripSummary({ plan }: { plan: TripPlan }) {
  const { summary, logs } = plan
  const fuelStops = plan.events.filter((event) => event.kind === 'fuel').length
  const rests = plan.events.filter((event) => event.kind === 'rest').length

  const facts = [
    { label: 'Distance', value: `${formatMiles(summary.distance_miles)} mi` },
    { label: 'Driving time', value: formatDuration(summary.driving_minutes) },
    { label: 'Arrives', value: `${formatDate(summary.arrival)}, ${formatTime(summary.arrival)}` },
    { label: 'Trip length', value: formatDuration(summary.duration_minutes) },
  ]

  return (
    <section aria-label="Trip summary">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        {facts.map((fact) => (
          <div key={fact.label} className="reveal">
            <dt className="text-xs text-pencil">{fact.label}</dt>
            <dd className="text-lg font-bold leading-snug tabular-nums text-print">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className="reveal mt-5">
        <div className="flex h-2 overflow-hidden rounded-full bg-rule" role="img" aria-label={`${formatHours(summary.cycle_used_end)} of ${CYCLE_LIMIT} cycle hours used after the trip`}>
          <div className="bg-ink" style={{ width: `${(summary.cycle_used_end / CYCLE_LIMIT) * 100}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-pencil">
          {formatHours(summary.cycle_used_end)} of {CYCLE_LIMIT} cycle hours used on arrival
          {summary.restarted && ', after a 34-hour restart on the way'}
        </p>
      </div>

      <p className="reveal mt-4 text-sm text-print">
        {logs.length} daily log {logs.length === 1 ? 'sheet' : 'sheets'}, {rests} overnight{' '}
        {rests === 1 ? 'rest' : 'rests'}, {fuelStops} fuel {fuelStops === 1 ? 'stop' : 'stops'}.
      </p>
    </section>
  )
}
