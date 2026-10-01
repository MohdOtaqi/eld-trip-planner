import type { TripEvent, TripPlan } from '../lib/api'
import { formatDay, formatDuration, formatMiles, formatTime } from '../lib/format'
import { KINDS, STATUSES } from '../lib/stops'

interface Props {
  plan: TripPlan
  selected: number | null
  onSelect: (index: number) => void
}

export function Itinerary({ plan, selected, onSelect }: Props) {
  const stopOf = (event: TripEvent) =>
    plan.stops.findIndex((stop) => event.start >= stop.arrival && event.end <= stop.departure)

  return (
    <section aria-label="Itinerary">
      <ol>
        {plan.events.map((event, i) => {
          const previous = plan.events[i - 1]
          const newDay = !previous || previous.start.slice(0, 10) !== event.start.slice(0, 10)
          const isDrive = event.kind === 'drive'
          const stopIndex = isDrive ? -1 : stopOf(event)
          const { icon: Icon, label } = KINDS[event.kind]
          const next = plan.events[i + 1]

          const body = (
            <>
              <span className="w-[4.2rem] shrink-0 pt-0.5 text-right text-[13px] tabular-nums text-pencil">
                {formatTime(event.start)}
              </span>
              <span
                className="relative mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-white"
                style={{ background: STATUSES[event.status].color }}
              >
                <Icon size={13} strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug text-print">
                  {isDrive ? `Drive ${formatMiles(event.miles)} mi` : label}
                </span>
                <span className="block text-[13px] text-pencil">
                  {isDrive && next ? `to ${next.place}, ` : `${event.place}, `}
                  {formatDuration(event.minutes)}
                </span>
              </span>
            </>
          )

          return (
            <li key={event.start} className="reveal">
              {newDay && (
                <h3 className={`mb-1 border-b border-rule pb-1 text-sm font-bold text-print ${i ? 'mt-5' : ''}`}>
                  {formatDay(event.start)}
                </h3>
              )}
              {isDrive ? (
                <div className="flex gap-3 px-2 py-1.5">{body}</div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(stopIndex)}
                  aria-pressed={stopIndex === selected}
                  className={`flex w-full cursor-pointer gap-3 rounded-md px-2 py-1.5 text-left hover:bg-ink/8 ${
                    stopIndex === selected ? 'bg-ink/10' : ''
                  }`}
                >
                  {body}
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
