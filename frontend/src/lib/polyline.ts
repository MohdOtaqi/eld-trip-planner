export type LngLat = [number, number]

export interface MeasuredRoute {
  coordinates: LngLat[]
  miles: number[]
}

export function decodePolyline(encoded: string, precision = 6): LngLat[] {
  const factor = 10 ** precision
  const points: LngLat[] = []
  let index = 0
  let lat = 0
  let lng = 0

  const next = () => {
    let result = 0
    let shift = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }

  while (index < encoded.length) {
    lat += next()
    lng += next()
    points.push([lng / factor, lat / factor])
  }
  return points
}

function haversine([lng1, lat1]: LngLat, [lng2, lat2]: LngLat) {
  const rad = Math.PI / 180
  const h =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2
  return 2 * Math.asin(Math.sqrt(h))
}

/** Cumulative distance at every point, scaled so the route ends at the trip's total miles. */
export function measureRoute(coordinates: LngLat[], totalMiles: number): MeasuredRoute {
  const miles = [0]
  for (let i = 1; i < coordinates.length; i++) {
    miles.push(miles[i - 1] + haversine(coordinates[i - 1], coordinates[i]))
  }
  const scale = totalMiles / (miles[miles.length - 1] || 1)
  return { coordinates, miles: miles.map((value) => value * scale) }
}

export function pointAt({ coordinates, miles }: MeasuredRoute, odometer: number): LngLat {
  let low = 0
  let high = miles.length - 1
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if (miles[middle] <= odometer) low = middle
    else high = middle
  }
  const span = miles[high] - miles[low]
  const ratio = span ? Math.min(Math.max((odometer - miles[low]) / span, 0), 1) : 0
  const [lng1, lat1] = coordinates[low]
  const [lng2, lat2] = coordinates[high]
  return [lng1 + (lng2 - lng1) * ratio, lat1 + (lat2 - lat1) * ratio]
}
