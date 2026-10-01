import {
  BedDouble,
  ClipboardCheck,
  Coffee,
  Flag,
  Fuel,
  MapPin,
  Package,
  TimerReset,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import type { EventKind, Status, Stop, StopKind } from './api'

interface KindInfo {
  label: string
  remark: string
  icon: LucideIcon
}

export const KINDS: Record<EventKind, KindInfo> = {
  drive: { label: 'Drive', remark: 'Driving', icon: Truck },
  pre_trip: { label: 'Pre-trip inspection', remark: 'Pre-trip', icon: ClipboardCheck },
  pickup: { label: 'Pickup', remark: 'Pickup', icon: Package },
  dropoff: { label: 'Drop-off', remark: 'Drop-off', icon: Flag },
  fuel: { label: 'Fuel stop', remark: 'Fuel', icon: Fuel },
  break: { label: '30-minute break', remark: '30-min break', icon: Coffee },
  rest: { label: '10-hour rest', remark: '10-hr rest', icon: BedDouble },
  restart: { label: '34-hour restart', remark: '34-hr restart', icon: TimerReset },
}

export const STATUSES: Record<Status, { label: string; color: string }> = {
  off_duty: { label: 'Off duty', color: 'var(--color-off-duty)' },
  sleeper: { label: 'Sleeper berth', color: 'var(--color-sleeper)' },
  driving: { label: 'Driving', color: 'var(--color-driving)' },
  on_duty: { label: 'On duty', color: 'var(--color-on-duty)' },
}

const PRIORITY: StopKind[] = ['pickup', 'dropoff', 'restart', 'rest', 'fuel', 'break', 'pre_trip']

const STOP_COLORS: Record<StopKind, string> = {
  pickup: 'var(--color-ink)',
  dropoff: 'var(--color-stop)',
  restart: 'var(--color-sleeper)',
  rest: 'var(--color-sleeper)',
  fuel: 'var(--color-on-duty)',
  break: 'var(--color-off-duty)',
  pre_trip: 'var(--color-driving)',
}

export function describeStop(stop: Stop, index: number) {
  const main = PRIORITY.find((kind) => stop.kinds.includes(kind)) ?? stop.kinds[0]
  const activities = stop.kinds.map((kind) => KINDS[kind].label)
  const isStart = index === 0 && main === 'pre_trip'
  return {
    icon: isStart ? MapPin : KINDS[main].icon,
    color: STOP_COLORS[main],
    title: isStart ? 'Trip start' : activities.join(' + '),
    activities,
    major: isStart || main === 'pickup' || main === 'dropoff',
  }
}
