import { Flag, LoaderCircle, MapPin, Package } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { searchAddresses, searchCities, type Place, type TripRequest } from '../lib/api'
import { nextQuarterHour } from '../lib/format'
import { PlaceInput, type PlaceValue } from './PlaceInput'

const CYCLE_LIMIT = 70

const FIELDS = [
  { key: 'current', label: 'Current location', placeholder: 'Where the truck is now', icon: MapPin },
  { key: 'pickup', label: 'Pickup location', placeholder: 'Shipper city or address', icon: Package },
  { key: 'dropoff', label: 'Drop-off location', placeholder: 'Receiver city or address', icon: Flag },
] as const

type FieldKey = (typeof FIELDS)[number]['key']

const EXAMPLE: Record<FieldKey, Place> = {
  current: { label: 'Chicago, IL', lat: 41.85, lng: -87.65 },
  pickup: { label: 'Dallas, TX', lat: 32.7831, lng: -96.8067 },
  dropoff: { label: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437 },
}

const empty: PlaceValue = { text: '', place: null }

interface Props {
  busy: boolean
  error: string | null
  onPlan: (request: TripRequest) => void
}

export function TripForm({ busy, error, onPlan }: Props) {
  const cycleId = useId()
  const departureId = useId()
  const [places, setPlaces] = useState<Record<FieldKey, PlaceValue>>({
    current: empty,
    pickup: empty,
    dropoff: empty,
  })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [cycleUsed, setCycleUsed] = useState('0')
  const [departure, setDeparture] = useState(nextQuarterHour)
  const [resolving, setResolving] = useState(false)

  const cycle = Math.min(Math.max(Number(cycleUsed) || 0, 0), CYCLE_LIMIT)
  const working = busy || resolving

  const setPlace = (key: FieldKey, value: PlaceValue) => {
    setPlaces((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: undefined }))
  }

  const fillExample = () => {
    setPlaces({
      current: { text: EXAMPLE.current.label, place: EXAMPLE.current },
      pickup: { text: EXAMPLE.pickup.label, place: EXAMPLE.pickup },
      dropoff: { text: EXAMPLE.dropoff.label, place: EXAMPLE.dropoff },
    })
    setFieldErrors({})
    setCycleUsed('20')
  }

  // Typed text that was never picked from the list is matched to its best search result.
  const resolve = async (key: FieldKey): Promise<Place | string> => {
    const { text, place } = places[key]
    if (place) return place
    if (!text.trim()) return 'Enter a location.'
    try {
      const query = text.trim()
      const cities = await searchCities(query)
      const [match] = cities.length ? cities : await searchAddresses(query)
      if (!match) return 'No place found with that name.'
      const found = { label: match.label, lat: match.lat, lng: match.lng }
      setPlace(key, { text: match.label, place: found })
      return found
    } catch {
      return 'Place search is unavailable. Try again.'
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (working) return
    setResolving(true)
    const [current, pickup, dropoff] = await Promise.all(FIELDS.map((field) => resolve(field.key)))
    setResolving(false)

    const errors: Partial<Record<FieldKey, string>> = {}
    if (typeof current === 'string') errors.current = current
    if (typeof pickup === 'string') errors.pickup = pickup
    if (typeof dropoff === 'string') errors.dropoff = dropoff
    setFieldErrors(errors)
    if (typeof current === 'string' || typeof pickup === 'string' || typeof dropoff === 'string') return

    onPlan({ current, pickup, dropoff, cycle_used: cycle, departure })
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="relative space-y-5">
        <div
          aria-hidden
          className="absolute bottom-12 left-[13px] top-7 border-l-[1.5px] border-dashed border-print/35"
        />
        {FIELDS.map(({ key, label, placeholder, icon: Icon }) => (
          <PlaceInput
            key={key}
            label={label}
            placeholder={placeholder}
            marker={
              <span className="relative grid size-7 place-items-center rounded-full bg-paper ring-[1.5px] ring-print/70">
                <Icon size={14} strokeWidth={2.2} />
              </span>
            }
            value={places[key]}
            error={fieldErrors[key]}
            onChange={(value) => setPlace(key, value)}
          />
        ))}
      </div>

      <div className="mt-7 grid grid-cols-[1fr_auto] items-end gap-x-4">
        <div>
          <input
            type="range"
            min={0}
            max={CYCLE_LIMIT}
            step={0.25}
            value={cycle}
            aria-label="Current cycle used, hours"
            onChange={(event) => setCycleUsed(event.target.value)}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-ink"
            style={{
              background: `linear-gradient(to right, var(--color-ink) ${(cycle / CYCLE_LIMIT) * 100}%, var(--color-rule) 0)`,
            }}
          />
          <label htmlFor={cycleId} className="mt-2 block text-xs text-pencil">
            Current cycle used (hours)
            <span className="float-right tabular-nums">
              {CYCLE_LIMIT - cycle} h left of {CYCLE_LIMIT}
            </span>
          </label>
        </div>
        <input
          id={cycleId}
          type="number"
          inputMode="decimal"
          min={0}
          max={CYCLE_LIMIT}
          step={0.25}
          value={cycleUsed}
          onChange={(event) => setCycleUsed(event.target.value)}
          onBlur={() => setCycleUsed(String(cycle))}
          className="mb-5 w-20 border-b-[1.5px] border-print/70 bg-transparent pb-1 text-right text-[17px] font-semibold tabular-nums text-print focus:border-ink focus:outline-none"
        />
      </div>

      <div className="mt-5">
        <input
          id={departureId}
          type="datetime-local"
          step={900}
          required
          value={departure}
          onChange={(event) => setDeparture(event.target.value)}
          className="w-full border-b-[1.5px] border-print/70 bg-transparent pb-1 text-[17px] font-medium text-print focus:border-ink focus:outline-none"
        />
        <label htmlFor={departureId} className="mt-1 block text-xs text-pencil">
          Departure, home terminal time
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-5 border-l-[3px] border-stop bg-stop/8 px-3 py-2 text-sm text-print">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center gap-4">
        <button
          type="submit"
          disabled={working || !departure}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-ink px-5 text-[15px] font-semibold text-white transition-colors hover:bg-ink-dark disabled:opacity-70"
        >
          {working && <LoaderCircle size={17} className="animate-spin" />}
          {working ? 'Planning trip' : 'Plan trip'}
        </button>
        <button
          type="button"
          onClick={fillExample}
          className="text-sm font-medium text-ink underline decoration-ink/40 underline-offset-4 hover:decoration-ink"
        >
          Use an example
        </button>
      </div>
    </form>
  )
}
