import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Truck } from 'lucide-react'
import maplibregl, { type ExpressionSpecification, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Stop, TripPlan } from '../lib/api'
import { formatDay, formatMiles, formatTime } from '../lib/format'
import { decodePolyline, measureRoute, pointAt } from '../lib/polyline'
import { describeStop } from '../lib/stops'

const STYLE = 'https://tiles.openfreemap.org/styles/dark'
const LANE = '#f6c744'
const HOME: [number, number] = [-97, 38]

// The stock dark style is neutral grey. Shift it toward night blue and lift the highways.
const TINT: [layer: string, property: string, value: string][] = [
  ['background', 'background-color', '#1a2435'],
  ['water', 'fill-color', '#0b111b'],
  ['waterway', 'line-color', '#0b111b'],
  ['landcover_wood', 'fill-color', '#1c2a38'],
  ['landuse_park', 'fill-color', '#1c2a38'],
  ['landuse_residential', 'fill-color', '#1d283b'],
  ['landcover_glacier', 'fill-color', '#243044'],
  ['landcover_ice_shelf', 'fill-color', '#243044'],
  ['building', 'fill-color', '#222e43'],
  ['boundary_state', 'line-color', '#3a4a66'],
  ['boundary_country_z0-4', 'line-color', '#5a6d92'],
  ['boundary_country_z5-', 'line-color', '#5a6d92'],
  ['highway_motorway_subtle', 'line-color', '#3d4d6b'],
  ['highway_major_subtle', 'line-color', '#2f3c55'],
  ['highway_motorway_casing', 'line-color', '#4c5f85'],
  ['highway_major_casing', 'line-color', '#3a4a66'],
  ['highway_minor', 'line-color', '#2b374d'],
]
const LABELS = [
  'place_other',
  'place_suburb',
  'place_village',
  'place_town',
  'place_city',
  'place_city_large',
  'place_state',
  'place_country_other',
  'place_country_minor',
  'place_country_major',
]

interface Props {
  plan: TripPlan | null
  selected: number | null
  onSelect: (index: number | null) => void
  odometer: number
  leftInset: number
}

interface Pin {
  element: HTMLDivElement
  stop: Stop
  index: number
}

const revealed = (progress: number): ExpressionSpecification => [
  'step',
  ['line-progress'],
  LANE,
  Math.max(progress, 0.0001),
  'rgba(246, 199, 68, 0)',
]

export default function RouteMap({ plan, selected, onSelect, odometer, leftInset }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [ready, setReady] = useState(false)
  const [pins, setPins] = useState<Pin[]>([])
  const truck = useRef<maplibregl.Marker | null>(null)
  const [truckNode, setTruckNode] = useState<HTMLDivElement | null>(null)
  const route = useMemo(
    () => plan && measureRoute(decodePolyline(plan.route.polyline), plan.summary.distance_miles),
    [plan],
  )
  const popupNode = useMemo(() => document.createElement('div'), [])
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: STYLE,
      center: HOME,
      zoom: container.current!.clientHeight < 520 ? 1.4 : 2.6,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    map.on('styleimagemissing', ({ id }) => {
      if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) })
    })
    map.on('style.load', () => {
      map.setProjection({ type: 'globe' })
      map.setSky({
        'sky-color': '#0d131d',
        'horizon-color': '#35507f',
        'fog-color': '#0d131d',
        'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 4.5, 1, 6.5, 0],
      })
      for (const [layer, property, value] of TINT) {
        if (map.getLayer(layer)) map.setPaintProperty(layer, property, value)
      }
      for (const layer of LABELS) {
        if (!map.getLayer(layer)) continue
        map.setPaintProperty(layer, 'text-color', '#9aa8c2')
        map.setPaintProperty(layer, 'text-halo-color', 'rgba(13, 19, 29, 0.85)')
      }
      map.addSource('route', {
        type: 'geojson',
        lineMetrics: true,
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      })
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#05080d', 'line-opacity': 0.7, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 6, 12, 12] },
      })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 3, 12, 7], 'line-gradient': revealed(0) },
      })
      setReady(true)
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    mapRef.current?.setPadding({ left: leftInset, top: 0, right: 0, bottom: 0 })
  }, [leftInset])

  // A pin click reaches the map too, so popups are closed here instead of by closeOnClick.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const close = (event: maplibregl.MapMouseEvent) => {
      if (!(event.originalEvent.target as HTMLElement).closest('.stop-pin')) onSelect(null)
    }
    map.on('click', close)
    return () => {
      map.off('click', close)
    }
  }, [onSelect])

  // Slowly turn the globe until there is a trip to show or the user takes over.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || plan || reducedMotion) return
    let frame = 0
    let last = performance.now()
    const spin = (now: number) => {
      const center = map.getCenter()
      center.lng += (now - last) * 0.002
      last = now
      map.jumpTo({ center })
      frame = requestAnimationFrame(spin)
    }
    const stop = () => cancelAnimationFrame(frame)
    frame = requestAnimationFrame(spin)
    map.once('mousedown', stop)
    map.once('touchstart', stop)
    map.once('wheel', stop)
    return stop
  }, [ready, plan, reducedMotion])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !plan || !route) return

    const { coordinates } = route
    const source = map.getSource<GeoJSONSource>('route')!
    source.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })

    const bounds = coordinates.reduce(
      (box, point) => box.extend(point),
      new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
    )
    map.fitBounds(bounds, {
      padding: leftInset ? { top: 80, bottom: 170, left: 70, right: 70 } : 44,
      duration: reducedMotion ? 0 : 2200,
      maxZoom: 11,
    })

    const progress = { value: reducedMotion ? 1 : 0 }
    const draw = () => map.setPaintProperty('route-line', 'line-gradient', revealed(progress.value))
    draw()
    const tween = gsap.to(progress, { value: 1, duration: 2.4, delay: 0.5, ease: 'power2.inOut', onUpdate: draw })

    const markers = plan.stops.map((stop, index) => {
      const element = document.createElement('div')
      element.style.zIndex = describeStop(stop, index).major ? '2' : '1'
      const marker = new maplibregl.Marker({ element }).setLngLat([stop.lng, stop.lat]).addTo(map)
      return { marker, pin: { element, stop, index } }
    })
    setPins(markers.map((m) => m.pin))

    const truckElement = document.createElement('div')
    truckElement.style.zIndex = '3'
    truck.current = new maplibregl.Marker({ element: truckElement }).setLngLat(coordinates[0]).addTo(map)
    setTruckNode(truckElement)

    return () => {
      tween.kill()
      markers.forEach((m) => m.marker.remove())
      truck.current?.remove()
      truck.current = null
      setPins([])
      setTruckNode(null)
    }
  }, [ready, plan, route, reducedMotion, leftInset])

  useEffect(() => {
    if (route && truckNode) truck.current?.setLngLat(pointAt(route, odometer))
  }, [route, truckNode, odometer])

  useGSAP(
    () => {
      if (!pins.length || reducedMotion) return
      gsap.from('.stop-pin', {
        scale: 0,
        opacity: 0,
        duration: 0.5,
        ease: 'back.out(2.2)',
        stagger: 2.2 / pins.length,
        delay: 0.7,
        clearProps: 'transform,opacity',
      })
    },
    { dependencies: [pins], scope: container },
  )

  const stop = plan && selected !== null ? plan.stops[selected] : null

  useEffect(() => {
    const map = mapRef.current
    if (!map || !stop) return
    const popup = new maplibregl.Popup({ offset: 22, maxWidth: '280px', focusAfterOpen: false, closeOnClick: false })
      .setLngLat([stop.lng, stop.lat])
      .setDOMContent(popupNode)
      .addTo(map)
    const onClose = () => onSelect(null)
    popup.on('close', onClose)
    map.flyTo({
      center: [stop.lng, stop.lat],
      zoom: Math.max(map.getZoom(), 6.5),
      duration: reducedMotion ? 0 : 1400,
    })
    return () => {
      popup.off('close', onClose)
      popup.remove()
    }
  }, [stop, onSelect, popupNode, reducedMotion])

  return (
    <div
      ref={container}
      className="on-dark size-full"
      style={{ background: 'radial-gradient(circle at 62% 45%, #1a2a4a 0%, #0d131d 62%)' }}
    >
      {pins.map(({ element, stop, index }) =>
        createPortal(
          <StopPin stop={stop} index={index} active={index === selected} onClick={() => onSelect(index)} />,
          element,
          index,
        ),
      )}
      {stop && createPortal(<StopCard stop={stop} index={selected!} />, popupNode)}
      {truckNode &&
        createPortal(
          <span className="stop-pin grid size-8 place-items-center rounded-full border-2 border-asphalt-950 bg-lane text-asphalt-950 shadow-lg shadow-black/60">
            <Truck size={16} strokeWidth={2.4} />
          </span>,
          truckNode,
        )}
    </div>
  )
}

function StopPin({ stop, index, active, onClick }: { stop: Stop; index: number; active: boolean; onClick: () => void }) {
  const { icon: Icon, color, title, major } = describeStop(stop, index)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title}, ${stop.place}`}
      className={`stop-pin grid cursor-pointer place-items-center rounded-full border-2 border-white text-white shadow-lg shadow-black/50 transition-transform hover:scale-110 ${
        major ? 'size-9' : 'size-7'
      } ${active ? 'scale-110 ring-4 ring-lane/60' : ''}`}
      style={{ background: color }}
    >
      <Icon size={major ? 17 : 14} strokeWidth={2.3} />
    </button>
  )
}

function StopCard({ stop, index }: { stop: Stop; index: number }) {
  const { title, activities } = describeStop(stop, index)
  const sameDay = stop.arrival.slice(0, 10) === stop.departure.slice(0, 10)
  return (
    <div className="px-4 py-3 pr-9 font-sans">
      <p className="text-[15px] font-bold leading-snug">{title}</p>
      <p className="text-sm text-pencil">{stop.place}</p>
      {title === 'Trip start' && <p className="mt-1 text-sm">{activities.join(', ')}</p>}
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm tabular-nums">
        <dt className="text-pencil">Arrive</dt>
        <dd>
          {formatDay(stop.arrival)}, {formatTime(stop.arrival)}
        </dd>
        <dt className="text-pencil">Leave</dt>
        <dd>
          {sameDay ? '' : `${formatDay(stop.departure)}, `}
          {formatTime(stop.departure)}
        </dd>
        <dt className="text-pencil">Trip mile</dt>
        <dd>{formatMiles(stop.odometer)}</dd>
      </dl>
    </div>
  )
}
