import { lazy, Suspense, useState } from 'react'
import type { TripPlan } from '../lib/api'
import { momentAt } from '../lib/replay'
import { Replay } from './Replay'

const RouteMap = lazy(() => import('./RouteMap'))

const PANEL_WIDTH = 440

interface Props {
  plan: TripPlan | null
  selected: number | null
  onSelect: (index: number | null) => void
  desktop: boolean
}

export function MapStage({ plan, selected, onSelect, desktop }: Props) {
  const [minute, setMinute] = useState(0)
  const [shown, setShown] = useState(plan)

  // A new trip starts its replay from the beginning.
  if (shown !== plan) {
    setShown(plan)
    setMinute(0)
  }

  return (
    <>
      <div className={`isolate h-[46dvh] lg:absolute lg:inset-0 lg:h-auto ${plan ? 'replay-open' : ''}`}>
        <Suspense fallback={<div className="size-full bg-asphalt-950" />}>
          <RouteMap
            plan={plan}
            selected={selected}
            onSelect={onSelect}
            odometer={plan ? momentAt(plan, minute).odometer : 0}
            leftInset={desktop ? PANEL_WIDTH + 16 : 0}
          />
        </Suspense>
      </div>
      {plan && (
        <div className="lg:absolute lg:bottom-4 lg:left-[472px] lg:right-4">
          <Replay plan={plan} minute={minute} onChange={setMinute} />
        </div>
      )}
    </>
  )
}
