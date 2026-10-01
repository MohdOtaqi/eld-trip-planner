import type { Clocks, TripPlan } from './api'

export const CLOCK_LIMITS: Clocks = { break: 8 * 60, drive: 11 * 60, shift: 14 * 60, cycle: 70 * 60 }

/** Where the driver is, and what is left on each clock, a number of minutes into the trip. */
export function momentAt(plan: TripPlan, minute: number) {
  const at = Date.parse(plan.summary.departure) + minute * 60_000
  let index = plan.events.findIndex((event) => at < Date.parse(event.end))
  if (index < 0) index = plan.events.length - 1

  const event = plan.events[index]
  const next = plan.events[index + 1]
  const start = Date.parse(event.start)
  const fraction = Math.min(Math.max((at - start) / (Date.parse(event.end) - start), 0), 1)

  // Clocks are recorded at the start of each event; in between they run down (or refill) evenly.
  const from = event.clocks
  const to = next?.clocks ?? plan.clocks_at_arrival
  const blend = (key: keyof Clocks) => from[key] + (to[key] - from[key]) * fraction

  return {
    event,
    next,
    time: new Date(at),
    odometer: event.odometer + event.miles * fraction,
    clocks: { break: blend('break'), drive: blend('drive'), shift: blend('shift'), cycle: blend('cycle') },
  }
}
