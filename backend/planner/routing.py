import math
from bisect import bisect_left
from dataclasses import dataclass
from itertools import pairwise

import requests
from django.conf import settings

OSRM_HOSTS = (
    "https://router.project-osrm.org/route/v1/driving",
    "https://routing.openstreetmap.de/routed-car/route/v1/driving",
)
METERS_PER_MILE = 1609.344
EARTH_RADIUS_MILES = 3958.8


class RoutingError(Exception):
    pass


class NoRouteError(RoutingError):
    pass


@dataclass
class Leg:
    """A drive between two waypoints, with cumulative miles and minutes at every point."""

    points: list
    miles: list
    minutes: list

    @property
    def total_miles(self):
        return self.miles[-1]

    @property
    def total_minutes(self):
        return self.minutes[-1]

    def position(self, fraction):
        """Return (lat, lng, miles) after driving the given fraction of the leg's time."""
        target = min(max(fraction, 0), 1) * self.total_minutes
        i = bisect_left(self.minutes, target)
        if i == 0:
            return (*self.points[0], 0.0)
        t0, t1 = self.minutes[i - 1], self.minutes[i]
        ratio = (target - t0) / (t1 - t0) if t1 > t0 else 1
        (lat0, lng0), (lat1, lng1) = self.points[i - 1], self.points[i]
        return (
            lat0 + (lat1 - lat0) * ratio,
            lng0 + (lng1 - lng0) * ratio,
            self.miles[i - 1] + (self.miles[i] - self.miles[i - 1]) * ratio,
        )


@dataclass
class Route:
    legs: list
    polyline: str


def haversine_miles(a, b):
    lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(h))


def decode_polyline(encoded, precision=6):
    points, index, lat, lng = [], 0, 0, 0
    factor = 10**precision
    while index < len(encoded):
        for is_lng in (False, True):
            shift = result = 0
            while True:
                byte = ord(encoded[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            delta = ~(result >> 1) if result & 1 else result >> 1
            if is_lng:
                lng += delta
            else:
                lat += delta
        points.append((lat / factor, lng / factor))
    return points


def fetch_route(waypoints):
    """Route through (lat, lng) waypoints, one leg per consecutive pair."""
    coordinates = ";".join(f"{lng:.6f},{lat:.6f}" for lat, lng in waypoints)
    params = {"overview": "full", "geometries": "polyline6", "steps": "true"}
    headers = {"User-Agent": settings.HTTP_USER_AGENT}

    for host in OSRM_HOSTS:
        try:
            response = requests.get(
                f"{host}/{coordinates}", params=params, headers=headers, timeout=20
            )
            data = response.json()
        except (requests.RequestException, ValueError):
            continue
        if data.get("code") in ("NoRoute", "NoSegment"):
            raise NoRouteError("No drivable route connects these locations.")
        if data.get("code") == "Ok":
            route = data["routes"][0]
            return Route([_build_leg(leg) for leg in route["legs"]], route["geometry"])

    raise RoutingError("The routing service is not responding.")


def _build_leg(osrm_leg):
    points, miles, minutes = [], [0.0], [0.0]
    for step in osrm_leg["steps"]:
        shape = decode_polyline(step["geometry"])
        if not points:
            points.append(shape[0])
        lengths = [haversine_miles(a, b) for a, b in pairwise(shape)]
        shape_length = sum(lengths)
        if not shape_length:
            continue
        # OSRM reports distance and time per step; spread them along the step's shape.
        step_miles = step["distance"] / METERS_PER_MILE
        step_minutes = step["duration"] / 60
        for point, length in zip(shape[1:], lengths):
            share = length / shape_length
            points.append(point)
            miles.append(miles[-1] + step_miles * share)
            minutes.append(minutes[-1] + step_minutes * share)
    return Leg(points, miles, minutes)
