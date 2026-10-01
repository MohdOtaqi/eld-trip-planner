import math
from dataclasses import replace
from datetime import datetime, timedelta

from . import hos
from .logs import build_daily_logs
from .places import nearest_city
from .routing import fetch_route


def plan_trip(current, pickup, dropoff, cycle_used, departure=None):
    route = fetch_route([(p["lat"], p["lng"]) for p in (current, pickup, dropoff)])
    to_pickup, to_dropoff = route.legs

    departure = _round_up(departure or datetime.now())
    cycle_minutes = math.ceil(cycle_used * 60 / hos.TICK) * hos.TICK

    planner = hos.TripPlanner(to_pickup, to_dropoff, departure, cycle_minutes)
    events = planner.plan()
    for event in events:
        event.place = nearest_city(event.lat, event.lng)

    driving = sum(e.minutes for e in events if e.status == hos.DRIVING)
    on_duty = sum(e.minutes for e in events if e.status == hos.ON_DUTY)
    restarted = any(e.kind == "restart" for e in events)
    arrival = events[-1].end

    return {
        "summary": {
            "distance_miles": round(to_pickup.total_miles + to_dropoff.total_miles, 1),
            "driving_minutes": driving,
            "on_duty_minutes": driving + on_duty,
            "duration_minutes": int((arrival - departure).total_seconds() // 60),
            "departure": _iso(departure),
            "arrival": _iso(arrival),
            "cycle_used_start": cycle_minutes / 60,
            "cycle_used_end": _cycle_after(events, cycle_minutes) / 60,
            "restarted": restarted,
        },
        "route": {
            "polyline": route.polyline,
            "legs": [
                {"distance_miles": round(leg.total_miles, 1), "duration_minutes": round(leg.total_minutes)}
                for leg in route.legs
            ],
        },
        "places": {"current": current, "pickup": pickup, "dropoff": dropoff},
        "events": [_serialize(event) for event in _join_drives(events)],
        "stops": _group_stops(events),
        "clocks_at_arrival": planner.clocks(),
        "logs": build_daily_logs(events, cycle_minutes),
    }


def _round_up(moment):
    moment = moment.replace(second=0, microsecond=0)
    remainder = moment.minute % hos.TICK
    return moment + timedelta(minutes=hos.TICK - remainder) if remainder else moment


def _iso(moment):
    return moment.isoformat(timespec="minutes")


def _cycle_after(events, cycle):
    for event in events:
        if event.kind == "restart":
            cycle = 0
        elif event.status in (hos.DRIVING, hos.ON_DUTY):
            cycle += event.minutes
    return cycle


def _join_drives(events):
    """Driving is split at midnight for the log sheets; join it back up for the itinerary."""
    joined = []
    for event in events:
        last = joined[-1] if joined else None
        if last and last.kind == event.kind == "drive" and last.end == event.start:
            joined[-1] = replace(last, end=event.end, miles=last.miles + event.miles)
        else:
            joined.append(event)
    return joined


def _serialize(event):
    return {
        "kind": event.kind,
        "status": event.status,
        "start": _iso(event.start),
        "end": _iso(event.end),
        "minutes": event.minutes,
        "place": event.place,
        "lat": round(event.lat, 5),
        "lng": round(event.lng, 5),
        "odometer": round(event.odometer, 1),
        "miles": round(event.miles, 1),
        "clocks": event.clocks,
    }


def _group_stops(events):
    """Merge back-to-back stops at one spot (e.g. rest then pre-trip) into a single map stop."""
    stops = []
    for event in events:
        if event.kind == "drive":
            continue
        if stops and stops[-1]["departure"] == _iso(event.start):
            stops[-1]["kinds"].append(event.kind)
            stops[-1]["departure"] = _iso(event.end)
            continue
        stops.append(
            {
                "kinds": [event.kind],
                "place": event.place,
                "lat": round(event.lat, 5),
                "lng": round(event.lng, 5),
                "arrival": _iso(event.start),
                "departure": _iso(event.end),
                "odometer": round(event.odometer, 1),
            }
        )
    return stops
