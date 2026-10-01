import csv
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

import requests
from django.conf import settings

from .routing import haversine_miles

PHOTON_URL = "https://photon.komoot.io/api/"
NORTH_AMERICA = "-168,14,-52,72"
CITIES_FILE = Path(__file__).parent / "data" / "cities.csv"


class PlaceSearchError(Exception):
    pass


def search(query, limit=6):
    params = {"q": query, "limit": limit + 4, "lang": "en", "bbox": NORTH_AMERICA}
    headers = {"User-Agent": settings.HTTP_USER_AGENT}
    try:
        response = requests.get(PHOTON_URL, params=params, headers=headers, timeout=8)
        response.raise_for_status()
        features = response.json()["features"]
    except (requests.RequestException, ValueError, KeyError) as exc:
        raise PlaceSearchError("Place search is not responding.") from exc

    results = {}
    for feature in features:
        lng, lat = feature["geometry"]["coordinates"]
        name, detail = _describe(feature["properties"])
        if name:
            label = f"{name}, {detail}" if detail else name
            results.setdefault(label, {"label": label, "name": name, "detail": detail, "lat": lat, "lng": lng})
    return list(results.values())[:limit]


def _describe(props):
    street = " ".join(filter(None, (props.get("housenumber"), props.get("street"))))
    name = props.get("name") or street
    context = [street if props.get("name") else "", props.get("city"), props.get("state")]
    if props.get("countrycode") != "US":
        context.append(props.get("country"))
    detail = []
    for part in context:
        if part and part != name and part not in detail:
            detail.append(part)
    return name, ", ".join(detail)


@lru_cache(maxsize=1)
def _city_grid():
    grid = defaultdict(list)
    with open(CITIES_FILE, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            lat, lng = float(row["lat"]), float(row["lng"])
            grid[int(lat // 1), int(lng // 1)].append((lat, lng, f"{row['name']}, {row['region']}"))
    return grid


def nearest_city(lat, lng):
    """Name the closest city or town as 'City, ST', the way a log's remarks are written."""
    grid = _city_grid()
    row, col = int(lat // 1), int(lng // 1)
    nearby = [
        city
        for r in range(row - 1, row + 2)
        for c in range(col - 1, col + 2)
        for city in grid.get((r, c), ())
    ]
    if not nearby:
        return f"{lat:.3f}, {lng:.3f}"
    return min(nearby, key=lambda city: haversine_miles((lat, lng), city[:2]))[2]
