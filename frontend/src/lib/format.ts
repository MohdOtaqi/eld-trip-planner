const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const miles = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

// Trip times are wall-clock times at the home terminal and carry no zone. Reading them as UTC
// keeps the arithmetic clear of daylight-saving changes in whatever zone the browser is in.
export const wallClock = (iso: string) => Date.parse(`${iso}Z`)

const toDate = (value: string | Date) => (typeof value === 'string' ? new Date(wallClock(value)) : value)

export const formatTime = (value: string | Date) => time.format(toDate(value))
export const formatDay = (value: string | Date) => day.format(toDate(value))
export const formatDate = (value: string | Date) => date.format(toDate(value))
export const formatMiles = (value: number) => miles.format(value)

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

export function formatHours(hours: number) {
  return String(Math.round(hours * 100) / 100)
}

export function toDateTimeInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function nextQuarterHour() {
  const date = new Date()
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0)
  return toDateTimeInput(date)
}
