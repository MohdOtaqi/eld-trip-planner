import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { searchPlaces, type Place, type PlaceResult } from '../lib/api'

export interface PlaceValue {
  text: string
  place: Place | null
}

interface Props {
  label: string
  placeholder: string
  marker: ReactNode
  value: PlaceValue
  error?: string
  onChange: (value: PlaceValue) => void
}

export function PlaceInput({ label, placeholder, marker, value, error, onChange }: Props) {
  const id = useId()
  const [found, setFound] = useState<PlaceResult[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const blurTimer = useRef<number>(undefined)

  const query = value.place ? '' : value.text.trim()

  const results = query.length < 2 ? [] : found

  useEffect(() => {
    if (query.length < 2) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchPlaces(query, controller.signal)
        .then((places) => {
          setFound(places)
          setActive(0)
        })
        .catch(() => {})
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const choose = (result: PlaceResult) => {
    onChange({ text: result.label, place: { label: result.label, lat: result.lat, lng: result.lng } })
    setOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !results.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => (i + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => (i - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(results[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && results.length > 0

  return (
    <div className="relative grid grid-cols-[28px_1fr] items-start gap-x-3">
      <div className="mt-1.5 flex justify-center text-print">{marker}</div>
      <div>
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${id}-option-${active}` : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          placeholder={placeholder}
          value={value.text}
          onChange={(event) => {
            onChange({ text: event.target.value, place: null })
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setOpen(false), 120)
          }}
          onKeyDown={onKeyDown}
          className={`w-full border-b-[1.5px] bg-transparent pb-1 pt-1 text-[17px] font-medium text-print placeholder:font-normal placeholder:text-pencil/60 focus:border-ink focus:outline-none ${
            error ? 'border-stop' : 'border-print/70'
          }`}
        />
        <label htmlFor={id} className="mt-1 block text-xs text-pencil">
          {label}
        </label>
        {error && (
          <p id={`${id}-error`} className="mt-0.5 text-xs font-medium text-stop">
            {error}
          </p>
        )}

        {showList && (
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label={`${label} suggestions`}
            onMouseDown={() => window.clearTimeout(blurTimer.current)}
            className="absolute left-10 right-0 top-9 z-20 overflow-hidden rounded-md border border-rule bg-white shadow-xl shadow-black/15"
          >
            {results.map((result, i) => (
              <li
                key={result.label}
                id={`${id}-option-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(result)}
                className={`cursor-pointer px-3 py-2 ${i === active ? 'bg-ink/10' : ''}`}
              >
                <span className="block text-sm font-semibold text-print">{result.name}</span>
                {result.detail && <span className="block text-xs text-pencil">{result.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
