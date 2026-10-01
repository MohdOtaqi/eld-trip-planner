import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef } from 'react'
import type { DailyLog, Status } from '../lib/api'
import { formatHours } from '../lib/format'
import { KINDS } from '../lib/stops'

export interface SheetDetails {
  carrier: string
  office: string
  terminal: string
  vehicles: string
  manifest: string
  shipper: string
}

const WIDTH = 1100
const HEIGHT = 940
const GRID = { x: 150, y: 392, hour: 35.5, row: 38 }
const GRID_RIGHT = GRID.x + 24 * GRID.hour
const GRID_BOTTOM = GRID.y + 4 * GRID.row

const ROWS: { status: Status; lines: string[] }[] = [
  { status: 'off_duty', lines: ['1. Off Duty'] },
  { status: 'sleeper', lines: ['2. Sleeper', 'Berth'] },
  { status: 'driving', lines: ['3. Driving'] },
  { status: 'on_duty', lines: ['4. On Duty', '(not driving)'] },
]

const HOURS = ['Mid-night', ...range(1, 12), 'Noon', ...range(1, 12), 'Mid-night']

const REMARK_ANGLE = 58
const REMARK_GAP = 31

const RECAP_70 = [
  ['A. Total', 'hours on', 'duty last 7', 'days', 'including', 'today.'],
  ['B. Total', 'hours', 'available', 'tomorrow', '70 hr.', 'minus A*'],
  ['C. Total', 'hours on', 'duty last 8', 'days', 'including', 'today.'],
]
const RECAP_60 = [
  ['A. Total', 'hours on', 'duty last 6', 'days', 'including', 'today.'],
  ['B. Total', 'hours', 'available', 'tomorrow', '60 hr.', 'minus A*'],
  ['C. Total', 'hours on', 'duty last 7', 'days', 'including', 'today.'],
]

function range(from: number, to: number) {
  return Array.from({ length: to - from }, (_, i) => String(from + i))
}

const x = (minute: number) => GRID.x + (minute / 60) * GRID.hour
const y = (status: Status) => GRID.y + (ROWS.findIndex((row) => row.status === status) + 0.5) * GRID.row

function dutyPath(log: DailyLog) {
  return log.entries
    .map((entry, i) => `${i ? 'V' : `M${x(entry.start)},`}${y(entry.status)} H${x(entry.end)}`)
    .join(' ')
}

// Keep the slanted labels from running into each other when stops are close together.
function remarkAnchors(log: DailyLog) {
  let previous = -Infinity
  return log.remarks.map((remark) => {
    const center = (x(remark.start) + x(remark.end)) / 2
    previous = Math.max(center, previous + REMARK_GAP)
    return previous
  })
}

interface Props {
  log: DailyLog
  details: SheetDetails
  play: boolean
}

export function LogSheet({ log, details, play }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const [year, month, day] = log.date.split('-')
  const anchors = remarkAnchors(log)

  useGSAP(
    () => {
      if (!play) return
      const media = gsap.matchMedia()
      media.add('(prefers-reduced-motion: no-preference)', () => {
        gsap
          .timeline()
          .fromTo('.duty-line', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2, ease: 'power1.inOut' })
          .from('.remark', { opacity: 0, duration: 0.35, stagger: 0.12 }, '-=1.4')
          .from('.total', { opacity: 0, duration: 0.3, stagger: 0.08 }, '-=0.5')
      })
    },
    { dependencies: [play, log], scope: svg },
  )

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Driver's daily log for ${month}/${day}/${year}`}
      className="block w-full bg-white font-sans text-print print:mx-auto print:h-[7.7in] print:w-auto"
      fill="currentColor"
    >
      <text x={40} y={50} fontSize={32} fontWeight={800}>
        Drivers Daily Log
      </text>
      <text x={152} y={72} fontSize={12.5} fontWeight={600}>
        (24 hours)
      </text>

      {[month, day, year].map((value, i) => {
        const left = 372 + i * 100
        return (
          <g key={i}>
            <line x1={left} x2={left + 80} y1={44} y2={44} stroke="currentColor" strokeWidth={1.4} />
            {i < 2 && (
              <text x={left + 90} y={46} fontSize={24} textAnchor="middle">
                /
              </text>
            )}
            <text x={left + 40} y={62} fontSize={12} fontWeight={600} textAnchor="middle">
              ({['month', 'day', 'year'][i]})
            </text>
            <Hand x={left + 40} y={38} size={24} anchor="middle">
              {value}
            </Hand>
          </g>
        )
      })}

      <text x={690} y={36} fontSize={12.5} fontWeight={700}>
        Original - File at home terminal.
      </text>
      <text x={690} y={56} fontSize={12.5} fontWeight={600}>
        Duplicate - Driver retains in his/her possession for 8 days.
      </text>

      <Field label="From:" x={140} width={380} y={108} value={log.from} />
      <Field label="To:" x={560} width={380} y={108} value={log.to} />

      <Box x={110} y={140} width={185} height={50} caption={['Total Miles Driving Today']} value={String(log.miles)} />
      <Box x={302} y={140} width={168} height={50} caption={['Total Mileage Today']} value={String(log.miles)} />
      <Box
        x={110}
        y={216}
        width={360}
        height={46}
        caption={['Truck/Tractor and Trailer Numbers or', 'License Plate(s)/State (show each unit)']}
        value={details.vehicles}
      />

      {[
        { y: 172, caption: 'Name of Carrier or Carriers', value: details.carrier },
        { y: 218, caption: 'Main Office Address', value: details.office },
        { y: 264, caption: 'Home Terminal Address', value: details.terminal },
      ].map((line) => (
        <g key={line.caption}>
          <line x1={495} x2={1010} y1={line.y} y2={line.y} stroke="currentColor" strokeWidth={1.4} />
          <text x={752} y={line.y + 15} fontSize={12} fontWeight={700} textAnchor="middle">
            {line.caption}
          </text>
          <Hand x={752} y={line.y - 7} size={21} anchor="middle">
            {line.value}
          </Hand>
        </g>
      ))}

      <rect x={128} y={330} width={942} height={62} />
      <g fill="#fff" fontSize={12} fontWeight={700} textAnchor="middle">
        {HOURS.map((label, hour) =>
          label === 'Mid-night' ? (
            <text key={hour}>
              <tspan x={x(hour * 60)} y={370}>
                Mid-
              </tspan>
              <tspan x={x(hour * 60)} y={384}>
                night
              </tspan>
            </text>
          ) : (
            <text key={hour} x={x(hour * 60)} y={384}>
              {label}
            </text>
          ),
        )}
        <text>
          <tspan x={1040} y={370}>
            Total
          </tspan>
          <tspan x={1040} y={384}>
            Hours
          </tspan>
        </text>
      </g>

      {ROWS.map((row, r) => {
        const top = GRID.y + r * GRID.row
        const bottom = top + GRID.row
        const fromTop = r < 2
        return (
          <g key={row.status} stroke="currentColor">
            <rect x={GRID.x} y={top} width={GRID_RIGHT - GRID.x} height={GRID.row} fill="#fff" strokeWidth={1.5} />
            {Array.from({ length: 24 * 4 }, (_, i) => {
              if (!i) return null
              const length = i % 4 === 0 ? GRID.row : i % 2 === 0 ? 18 : 10
              const tickX = x(i * 15)
              return (
                <line
                  key={i}
                  x1={tickX}
                  x2={tickX}
                  y1={fromTop ? top : bottom}
                  y2={fromTop ? top + length : bottom - length}
                  strokeWidth={i % 4 === 0 ? 1.2 : 1}
                />
              )
            })}
            <text stroke="none" x={42} fontSize={13} fontWeight={700}>
              {row.lines.map((line, i) => (
                <tspan key={line} x={42} y={top + (row.lines.length > 1 ? 16 : 24) + i * 15}>
                  {line}
                </tspan>
              ))}
            </text>
            <line x1={1016} x2={1068} y1={bottom - 5} y2={bottom - 5} strokeWidth={1.4} />
            <Hand className="total" x={1042} y={bottom - 11} size={21} anchor="middle">
              {formatHours(log.totals[row.status])}
            </Hand>
          </g>
        )
      })}

      <line x1={1016} x2={1068} y1={577} y2={577} stroke="currentColor" strokeWidth={1.4} />
      <line x1={1016} x2={1068} y1={581} y2={581} stroke="currentColor" strokeWidth={1.4} />
      <Hand className="total" x={1042} y={571} size={21} anchor="middle">
        24
      </Hand>

      <path
        className="duty-line"
        d={dutyPath(log)}
        pathLength={1}
        strokeDasharray={1}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={3.4}
        strokeLinejoin="round"
      />

      <text x={42} y={584} fontSize={17} fontWeight={800}>
        Remarks
      </text>
      <g stroke="var(--color-ink)" strokeWidth={1.8} fill="none">
        {log.remarks.map((remark, i) => {
          const left = x(remark.start)
          const right = x(remark.end)
          return (
            <g key={remark.start} className="remark">
              <path d={`M${left},${GRID_BOTTOM + 4} V${GRID_BOTTOM + 13} H${right} V${GRID_BOTTOM + 4}`} />
              <path d={`M${(left + right) / 2},${GRID_BOTTOM + 13} L${anchors[i]},${GRID_BOTTOM + 21}`} strokeWidth={1.2} />
              <g transform={`translate(${anchors[i] + 3}, ${GRID_BOTTOM + 30}) rotate(${REMARK_ANGLE})`}>
                <Hand x={0} y={0} size={18}>
                  {remark.place}
                </Hand>
                <Hand x={2} y={15} size={14}>
                  {remark.kinds.map((kind, n) => (n ? KINDS[kind].remark.toLowerCase() : KINDS[kind].remark)).join(', ')}
                </Hand>
              </g>
            </g>
          )
        })}
      </g>

      <line x1={46} x2={46} y1={598} y2={766} stroke="currentColor" strokeWidth={4} />
      <line x1={44} x2={405} y1={764} y2={764} stroke="currentColor" strokeWidth={4} />
      <line x1={715} x2={1005} y1={764} y2={764} stroke="currentColor" strokeWidth={4} />

      <text fontSize={15} fontWeight={700}>
        <tspan x={56} y={626}>
          Shipping
        </tspan>
        <tspan x={56} y={644}>
          Documents:
        </tspan>
      </text>
      <line x1={56} x2={185} y1={668} y2={668} stroke="currentColor" strokeWidth={1.2} />
      <Hand x={58} y={663} size={15}>
        {details.manifest}
      </Hand>
      <text fontSize={11.5} fontWeight={700}>
        <tspan x={56} y={681}>
          DVL or Manifest No.
        </tspan>
        <tspan x={56} y={694}>
          or
        </tspan>
      </text>
      <line x1={56} x2={185} y1={716} y2={716} stroke="currentColor" strokeWidth={1.2} />
      <Hand x={58} y={711} size={15}>
        {details.shipper}
      </Hand>
      <text x={56} y={729} fontSize={11.5} fontWeight={700}>
        Shipper &amp; Commodity
      </text>
      <text fontSize={12} fontWeight={700} textAnchor="middle">
        <tspan x={560} y={750}>
          Enter name of place you reported and where released from work and when and where each change of duty occurred.
        </tspan>
        <tspan x={560} y={768}>
          Use time standard of home terminal.
        </tspan>
      </text>

      <g fontSize={11.5} fontWeight={700}>
        <Lines x={46} y={798} lines={['Recap:', 'Complete at', 'end of day']} />
        <line x1={150} x2={215} y1={826} y2={826} stroke="currentColor" strokeWidth={1.2} />
        <Hand x={182} y={820} size={20} anchor="middle">
          {formatHours(log.recap.on_duty_today)}
        </Hand>
        <Lines x={152} y={840} lines={['On duty', 'hours', 'today,', 'Total lines', '3 & 4']} />

        <Lines x={250} y={798} lines={['70 Hour/', '8 Day', 'Drivers']} />
        {RECAP_70.map((lines, i) => (
          <RecapColumn
            key={i}
            x={330 + i * 90}
            lines={lines}
            value={formatHours(i === 1 ? log.recap.cycle_available : log.recap.cycle_used)}
          />
        ))}

        <Lines x={600} y={798} lines={['60 Hour/ 7', 'Day Drivers']} />
        {RECAP_60.map((lines, i) => (
          <RecapColumn key={i} x={690 + i * 90} lines={lines} />
        ))}

        <Lines
          x={965}
          y={798}
          lines={['*If you took', '34', 'consecutive', 'hours off', 'duty you', 'have 60/70', 'hours', 'available']}
        />
      </g>
      <line x1={44} x2={1070} y1={924} y2={924} stroke="currentColor" strokeWidth={4} />
    </svg>
  )
}

interface HandProps {
  x: number
  y: number
  size: number
  anchor?: 'start' | 'middle'
  className?: string
  children: string
}

function Hand({ x, y, size, anchor = 'start', className, children }: HandProps) {
  return (
    <text
      className={className}
      x={x}
      y={y}
      fontSize={size}
      fontWeight={400}
      textAnchor={anchor}
      fill="var(--color-ink)"
      stroke="var(--color-ink)"
      strokeWidth={0.35}
      style={{ fontFamily: 'var(--font-hand)' }}
    >
      {children}
    </text>
  )
}

function Field({ label, x, y, width, value }: { label: string; x: number; y: number; width: number; value: string }) {
  const start = x + (label.length > 4 ? 52 : 32)
  return (
    <g>
      <text x={x} y={y - 4} fontSize={16} fontWeight={800}>
        {label}
      </text>
      <line x1={start} x2={x + width} y1={y} y2={y} stroke="currentColor" strokeWidth={1.4} />
      <Hand x={start + 8} y={y - 7} size={22}>
        {value}
      </Hand>
    </g>
  )
}

function Box(props: { x: number; y: number; width: number; height: number; caption: string[]; value: string }) {
  const center = props.x + props.width / 2
  return (
    <g>
      <rect x={props.x} y={props.y} width={props.width} height={props.height} fill="none" stroke="currentColor" strokeWidth={1.8} />
      <text fontSize={12} fontWeight={700} textAnchor="middle">
        {props.caption.map((line, i) => (
          <tspan key={line} x={center} y={props.y + props.height + 15 + i * 15}>
            {line}
          </tspan>
        ))}
      </text>
      <Hand x={center} y={props.y + props.height / 2 + 9} size={25} anchor="middle">
        {props.value}
      </Hand>
    </g>
  )
}

function Lines({ x, y, lines }: { x: number; y: number; lines: string[] }) {
  return (
    <text>
      {lines.map((line, i) => (
        <tspan key={i} x={x} y={y + i * 14}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

function RecapColumn({ x, lines, value }: { x: number; lines: string[]; value?: string }) {
  return (
    <g>
      <text x={x} y={820} fontSize={15}>
        {lines[0].slice(0, 2)}
      </text>
      <line x1={x} x2={x + 76} y1={826} y2={826} stroke="currentColor" strokeWidth={1.2} />
      {value && (
        <Hand x={x + 46} y={820} size={20} anchor="middle">
          {value}
        </Hand>
      )}
      <Lines x={x} y={840} lines={lines} />
    </g>
  )
}
