import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ChevronDown } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { GridPreview } from './components/GridPreview'
import { Itinerary } from './components/Itinerary'
import { LogBook } from './components/LogBook'
import { TripForm } from './components/TripForm'
import { TripSummary } from './components/TripSummary'
import { planTrip, type TripPlan, type TripRequest } from './lib/api'

const RouteMap = lazy(() => import('./components/RouteMap'))

const DESKTOP = '(min-width: 1024px)'
const PANEL_WIDTH = 440

export default function App() {
  const panel = useRef<HTMLElement>(null)
  const results = useRef<HTMLDivElement>(null)
  const [plan, setPlan] = useState<TripPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP).matches)

  useEffect(() => {
    const media = window.matchMedia(DESKTOP)
    const update = () => setDesktop(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const submit = async (request: TripRequest) => {
    setBusy(true)
    setError(null)
    try {
      setPlan(await planTrip(request))
      setSelected(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The trip could not be planned.')
    } finally {
      setBusy(false)
    }
  }

  useGSAP(
    () => {
      if (!plan) return
      // On a phone the map sits above the form, so go back up to watch the route draw.
      if (desktop) results.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      else window.scrollTo({ top: 0, behavior: 'smooth' })
      const media = gsap.matchMedia()
      media.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.reveal', { opacity: 0, y: 10, duration: 0.45, stagger: 0.035, ease: 'power2.out', delay: 0.3 })
      })
    },
    { dependencies: [plan], scope: panel },
  )

  return (
    <main>
      <div className="relative flex flex-col lg:block lg:h-dvh print:hidden">
        <div className="isolate h-[46dvh] lg:absolute lg:inset-0 lg:h-auto">
          <Suspense fallback={<div className="size-full bg-asphalt-950" />}>
            <RouteMap
              plan={plan}
              selected={selected}
              onSelect={setSelected}
              leftInset={desktop ? PANEL_WIDTH + 16 : 0}
            />
          </Suspense>
        </div>

        <aside
          ref={panel}
          className="relative bg-paper text-print lg:absolute lg:bottom-4 lg:left-4 lg:top-4 lg:w-[440px] lg:overflow-y-auto lg:rounded-md lg:shadow-2xl lg:shadow-black/50"
        >
          <div className="px-6 pb-8 pt-6 sm:px-8">
            <header className="mb-7 flex items-center gap-3">
              <svg viewBox="0 0 40 28" className="h-7 w-10 shrink-0" aria-hidden>
                <path
                  d="M2 6h10v16h9V13h8V6h9"
                  fill="none"
                  stroke="var(--color-ink)"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div>
                <h1 className="text-[26px] font-extrabold leading-none tracking-tight">Driveline</h1>
                <p className="mt-1 text-[13px] text-pencil">Trip planner and driver&rsquo;s daily log</p>
              </div>
            </header>

            <TripForm busy={busy} error={error} onPlan={submit} />

            {plan ? (
              <div ref={results} className="mt-8 scroll-mt-4 border-t-2 border-print pt-6">
                <TripSummary plan={plan} />
                <div className="mt-7">
                  <Itinerary plan={plan} selected={selected} onSelect={setSelected} />
                </div>
              </div>
            ) : (
              <div className="mt-8 border-t border-rule pt-6">
                <GridPreview />
                <p className="mt-4 text-sm leading-relaxed text-pencil">
                  Plans the route and every stop the hours-of-service rules require for a property-carrying driver on
                  the 70-hour/8-day cycle, then fills in a daily log sheet for each day of the trip.
                </p>
              </div>
            )}

            <details className="mt-7 border-t border-rule pt-4 text-sm text-pencil">
              <summary className="cursor-pointer font-semibold text-print">Rules applied</summary>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
                <li>11 hours of driving inside a 14-hour window, then 10 hours in the sleeper berth.</li>
                <li>A 30-minute break once 8 hours of driving have built up.</li>
                <li>70 on-duty hours in 8 days. When they run out, a 34-hour restart.</li>
                <li>Fuel at least every 1,000 miles, 30 minutes on duty.</li>
                <li>1 hour on duty at pickup and at drop-off, and a 30-minute pre-trip inspection each day.</li>
                <li>Times are rounded to 15 minutes, the resolution of the paper log grid.</li>
              </ul>
            </details>
          </div>
        </aside>

        {plan && desktop && (
          <a
            href="#logs"
            className="absolute bottom-5 left-[calc(50%+228px)] flex -translate-x-1/2 items-center gap-2 rounded-full bg-lane py-2.5 pl-5 pr-4 text-sm font-bold text-asphalt-950 shadow-xl shadow-black/40 hover:brightness-105"
          >
            Daily logs, {plan.logs.length} {plan.logs.length === 1 ? 'sheet' : 'sheets'}
            <ChevronDown size={18} strokeWidth={2.6} />
          </a>
        )}
      </div>

      {plan && <LogBook logs={plan.logs} />}
    </main>
  )
}
