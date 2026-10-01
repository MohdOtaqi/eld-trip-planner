import { PencilLine, Printer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DailyLog } from '../lib/api'
import { formatDay } from '../lib/format'
import { STATUSES } from '../lib/stops'
import { LogSheet, type SheetDetails } from './LogSheet'

const DETAIL_FIELDS: { key: keyof SheetDetails; label: string; placeholder: string }[] = [
  { key: 'carrier', label: 'Name of carrier', placeholder: 'Carrier name' },
  { key: 'office', label: 'Main office address', placeholder: 'City, ST' },
  { key: 'terminal', label: 'Home terminal address', placeholder: 'City, ST' },
  { key: 'vehicles', label: 'Truck and trailer numbers', placeholder: 'Truck 123, trailer 20544' },
  { key: 'manifest', label: 'DVL or manifest no.', placeholder: '101601' },
  { key: 'shipper', label: 'Shipper and commodity', placeholder: 'Shipper, commodity' },
]

const blankDetails: SheetDetails = { carrier: '', office: '', terminal: '', vehicles: '', manifest: '', shipper: '' }

export function LogBook({ logs }: { logs: DailyLog[] }) {
  const section = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const [shown, setShown] = useState(logs)
  const [seen, setSeen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [details, setDetails] = useState(blankDetails)

  // A new trip starts back on its first sheet.
  if (shown !== logs) {
    setShown(logs)
    setActive(0)
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(section.current!)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="logs" ref={section} className="on-dark scroll-mt-0 bg-asphalt-900 px-4 pb-20 pt-10 sm:px-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white">Daily logs</h2>
            <p className="mt-1 max-w-[58ch] text-[15px] text-asphalt-300">
              One sheet per calendar day, midnight to midnight. Every duty change is drawn on the grid and noted in
              the remarks with the nearest town.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 whitespace-nowrap">
            <button
              type="button"
              onClick={() => setEditing((open) => !open)}
              aria-expanded={editing}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-asphalt-500 px-4 text-sm font-semibold text-asphalt-100 hover:border-asphalt-300"
            >
              <PencilLine size={16} />
              Fill in carrier details
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-lane px-4 text-sm font-bold text-asphalt-950 hover:brightness-105"
            >
              <Printer size={16} />
              Print all sheets
            </button>
          </div>
        </div>

        {editing && (
          <div className="mt-5 grid gap-x-5 gap-y-4 rounded-md border border-asphalt-700 bg-asphalt-800 p-5 sm:grid-cols-2 lg:grid-cols-3 print:hidden">
            {DETAIL_FIELDS.map((field) => (
              <label key={field.key} className="block text-xs text-asphalt-300">
                {field.label}
                <input
                  type="text"
                  value={details[field.key]}
                  placeholder={field.placeholder}
                  maxLength={48}
                  onChange={(event) => setDetails({ ...details, [field.key]: event.target.value })}
                  className="mt-1 block w-full border-b border-asphalt-500 bg-transparent pb-1 text-[15px] text-white placeholder:text-asphalt-500 focus:border-lane focus:outline-none"
                />
              </label>
            ))}
          </div>
        )}

        <div role="tablist" aria-label="Log sheets" className="mt-7 flex gap-2 overflow-x-auto pb-2 print:hidden">
          {logs.map((log, i) => (
            <button
              key={log.date}
              type="button"
              role="tab"
              id={`log-tab-${i}`}
              aria-selected={i === active}
              aria-controls={`log-sheet-${i}`}
              onClick={() => setActive(i)}
              className={`min-w-36 shrink-0 rounded-t-md px-4 pb-2.5 pt-3 text-left ${
                i === active ? 'bg-white text-print' : 'bg-asphalt-800 text-asphalt-300 hover:text-white'
              }`}
            >
              <span className="block text-xs">Day {i + 1}</span>
              <span className="block text-[15px] font-bold">{formatDay(`${log.date}T00:00`)}</span>
              <span className="mt-2 flex h-1.5 overflow-hidden rounded-full" aria-hidden>
                {log.entries.map((entry) => (
                  <span
                    key={entry.start}
                    style={{ flexGrow: entry.end - entry.start, background: STATUSES[entry.status].color }}
                  />
                ))}
              </span>
            </button>
          ))}
        </div>

        <div>
          {logs.map((log, i) => (
            <div
              key={log.date}
              id={`log-sheet-${i}`}
              role="tabpanel"
              aria-labelledby={`log-tab-${i}`}
              className={`-mt-2 overflow-x-auto rounded-b-md rounded-tr-md bg-white shadow-2xl shadow-black/40 print:mt-0 print:block print:break-after-page print:overflow-visible print:rounded-none print:shadow-none print:last:break-after-auto ${
                i === active ? '' : 'hidden'
              }`}
            >
              <div className="min-w-[880px] p-3 sm:p-5 print:min-w-0 print:p-0">
                <LogSheet log={log} details={details} play={seen && i === active} />
              </div>
            </div>
          ))}
        </div>

        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-asphalt-300 print:hidden">
          {Object.values(STATUSES).map((status) => (
            <li key={status.label} className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: status.color }} />
              {status.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
