const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const miles = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export const formatTime = (iso: string) => time.format(new Date(iso))
export const formatDay = (iso: string) => day.format(new Date(iso))
export const formatDate = (iso: string) => date.format(new Date(iso))
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
