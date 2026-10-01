export type Status = 'off_duty' | 'sleeper' | 'driving' | 'on_duty'
export type StopKind = 'pre_trip' | 'pickup' | 'dropoff' | 'fuel' | 'break' | 'rest' | 'restart'
export type EventKind = StopKind | 'drive'

export interface Place {
  label: string
  lat: number
  lng: number
}

export interface PlaceResult extends Place {
  name: string
  detail: string
}

export interface Clocks {
  break: number
  drive: number
  shift: number
  cycle: number
}

export interface TripEvent {
  kind: EventKind
  status: Status
  start: string
  end: string
  minutes: number
  place: string
  lat: number
  lng: number
  odometer: number
  miles: number
  clocks: Clocks
}

export interface Stop {
  kinds: StopKind[]
  place: string
  lat: number
  lng: number
  arrival: string
  departure: string
  odometer: number
}

export interface LogEntry {
  status: Status
  start: number
  end: number
}

export interface LogRemark {
  start: number
  end: number
  place: string
  kinds: StopKind[]
}

export interface DailyLog {
  date: string
  from: string
  to: string
  miles: number
  entries: LogEntry[]
  totals: Record<Status, number>
  remarks: LogRemark[]
  recap: { on_duty_today: number; cycle_used: number; cycle_available: number }
}

export interface TripPlan {
  summary: {
    distance_miles: number
    driving_minutes: number
    on_duty_minutes: number
    duration_minutes: number
    departure: string
    arrival: string
    cycle_used_start: number
    cycle_used_end: number
    restarted: boolean
  }
  route: {
    polyline: string
    legs: { distance_miles: number; duration_minutes: number }[]
  }
  places: { current: Place; pickup: Place; dropoff: Place }
  events: TripEvent[]
  stops: Stop[]
  clocks_at_arrival: Clocks
  logs: DailyLog[]
}

export interface TripRequest {
  current: Place
  pickup: Place
  dropoff: Place
  cycle_used: number
  departure: string
}

async function readError(response: Response) {
  try {
    const body = await response.json()
    if (typeof body.detail === 'string') return body.detail
  } catch {
    // not JSON, fall through to the generic message
  }
  return 'Something went wrong while planning the trip. Try again in a moment.'
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const response = await fetch(`/api/places?q=${encodeURIComponent(query)}`, { signal })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

export async function planTrip(request: TripRequest): Promise<TripPlan> {
  const response = await fetch('/api/trips/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}
