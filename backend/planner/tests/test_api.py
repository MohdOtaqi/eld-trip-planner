from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.test import APIClient

from planner.routing import Leg, NoRouteError, Route

CHICAGO = {"label": "Chicago, Illinois", "lat": 41.8781, "lng": -87.6298}
ST_LOUIS = {"label": "St. Louis, Missouri", "lat": 38.627, "lng": -90.1994}
DALLAS = {"label": "Dallas, Texas", "lat": 32.7767, "lng": -96.797}


def fake_route(waypoints):
    legs = [
        Leg([start, end], [0.0, miles], [0.0, miles])
        for start, end, miles in zip(waypoints, waypoints[1:], (300, 630))
    ]
    return Route(legs, "polyline")


class PlanTripApiTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()
        self.payload = {
            "current": CHICAGO,
            "pickup": ST_LOUIS,
            "dropoff": DALLAS,
            "cycle_used": 12.5,
            "departure": "2026-03-02T07:10",
        }

    def post(self):
        return self.client.post("/api/trips/plan", self.payload, format="json")

    @patch("planner.trips.fetch_route", side_effect=fake_route)
    def test_plans_a_trip(self, _):
        response = self.post()
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["summary"]["departure"], "2026-03-02T07:15")
        self.assertEqual(body["summary"]["distance_miles"], 930)
        self.assertEqual(body["events"][0]["place"], "Chicago, IL")
        self.assertEqual(body["stops"][-1]["kinds"], ["dropoff"])
        self.assertEqual(body["stops"][-1]["place"], "Dallas, TX")
        self.assertEqual(len(body["logs"]), 2)

    def test_rejects_cycle_hours_over_the_limit(self):
        self.payload["cycle_used"] = 71
        response = self.post()
        self.assertEqual(response.status_code, 400)
        self.assertIn("cycle_used", response.json())

    def test_requires_all_three_locations(self):
        del self.payload["pickup"]
        self.assertEqual(self.post().status_code, 400)

    @patch("planner.trips.fetch_route", side_effect=NoRouteError("No drivable route connects these locations."))
    def test_reports_unroutable_trips(self, _):
        response = self.post()
        self.assertEqual(response.status_code, 422)
        self.assertIn("No drivable route", response.json()["detail"])


class PlaceSearchApiTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()

    def test_short_queries_return_nothing(self):
        self.assertEqual(self.client.get("/api/places", {"q": "a"}).json(), [])

    @patch("planner.places.requests.get")
    def test_formats_and_dedupes_results(self, get):
        feature = {
            "geometry": {"coordinates": [-87.62, 41.87]},
            "properties": {
                "name": "Chicago",
                "state": "Illinois",
                "countrycode": "US",
                "country": "United States",
            },
        }
        get.return_value.json.return_value = {"features": [feature, feature]}
        results = self.client.get("/api/places", {"q": "chicago"}).json()
        self.assertEqual(
            results,
            [{"label": "Chicago, Illinois", "name": "Chicago", "detail": "Illinois", "lat": 41.87, "lng": -87.62}],
        )
