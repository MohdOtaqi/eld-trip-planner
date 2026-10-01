import csv
from collections import defaultdict
from functools import lru_cache
from itertools import islice
from pathlib import Path
from typing import NamedTuple

import requests
from django.conf import settings

from .routing import haversine_miles

PHOTON_URL = "https://photon.komoot.io/api/"
NORTH_AMERICA = "-168,14,-52,72"
CITIES_FILE = Path(__file__).parent / "data" / "cities.csv"


class City(NamedTuple):
    name: str
    region: str
    lat: float
    lng: float
    population: int

    @property
    def label(self):
        return f"{self.name}, {self.region}"


def search_cities(query, limit=6):
    """Cities starting with the query: US and Canada before Mexico, largest first. No network."""
    prefix = _search_key(query)
    matches = (city for key, city in _cities_by_size() if key.startswith(prefix))
    return [
        {"label": c.label, "name": c.name, "detail": c.region, "lat": c.lat, "lng": c.lng}
        for c in islice(matches, limit)
    ]


def search_addresses(query, limit=6):
    """Streets, addresses and businesses from Photon. Slower, and empty if Photon is unreachable."""
    params = {"q": query, "limit": limit + 4, "lang": "en", "bbox": NORTH_AMERICA}
    headers = {"User-Agent": settings.HTTP_USER_AGENT}
    try:
        response = requests.get(PHOTON_URL, params=params, headers=headers, timeout=8)
        response.raise_for_status()
        features = response.json()["features"]
    except (requests.RequestException, ValueError, KeyError):
        return []

    results = {}
    for feature in features:
        lng, lat = feature["geometry"]["coordinates"]
        name, detail = _describe(feature["properties"])
        if name:
            label = f"{name}, {detail}" if detail else name
            results.setdefault(
                label, {"label": label, "name": name, "detail": detail, "lat": lat, "lng": lng}
            )
    return list(results.values())[:limit]


def _describe(props):
    street = " ".join(filter(None, (props.get("housenumber"), props.get("street"))))
    name = props.get("name") or street
    context = [street if props.get("name") else "", props.get("city"), props.get("state")]
    if props.get("countrycode") != "US":
        context.append(props.get("country"))
    detail = []
    for part in context:
        if part and part not in detail:
            detail.append(part)
    return name, ", ".join(detail) or props.get("country", "")


def _search_key(text):
    return " ".join(text.casefold().replace(",", " ").replace(".", "").split())


@lru_cache(maxsize=1)
def _cities_by_size():
    ranked = sorted(_cities(), key=lambda city: (city.region == "MX", -city.population))
    return [(_search_key(city.label), city) for city in ranked]


@lru_cache(maxsize=1)
def _cities():
    with open(CITIES_FILE, encoding="utf-8", newline="") as f:
        return [
            City(
                row["name"],
                row["region"],
                float(row["lat"]),
                float(row["lng"]),
                int(row["population"]),
            )
            for row in csv.DictReader(f)
        ]


@lru_cache(maxsize=1)
def _city_grid():
    grid = defaultdict(list)
    for city in _cities():
        grid[int(city.lat // 1), int(city.lng // 1)].append(city)
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
    return min(nearby, key=lambda city: haversine_miles((lat, lng), (city.lat, city.lng))).label
