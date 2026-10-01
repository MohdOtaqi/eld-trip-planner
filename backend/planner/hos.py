"""Hours-of-service simulation for a property-carrying driver on the 70-hour/8-day rule.

The trip is walked in 15-minute steps, the same resolution as a paper log grid,
so every duty change lands on a grid line. All durations are in minutes.
"""

import math
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta

OFF_DUTY = "off_duty"
SLEEPER = "sleeper"
DRIVING = "driving"
ON_DUTY = "on_duty"

TICK = 15

MAX_DRIVING = 11 * 60
DUTY_WINDOW = 14 * 60
DRIVING_BEFORE_BREAK = 8 * 60
BREAK = 30
DAILY_REST = 10 * 60
CYCLE_LIMIT = 70 * 60
CYCLE_RESTART = 34 * 60

FUEL_RANGE_MILES = 1000
FUEL_STOP = 30
PRE_TRIP = 30
PICKUP = 60
DROPOFF = 60


@dataclass
class Event:
    kind: str
    status: str
    start: datetime
    end: datetime
    lat: float
    lng: float
    odometer: float
    miles: float = 0.0
    place: str = ""
    clocks: dict = field(default_factory=dict)

    @property
    def minutes(self):
        return int((self.end - self.start).total_seconds() // 60)


class TripPlanner:
    def __init__(self, to_pickup, to_dropoff, departure, cycle_used):
        self.legs = (to_pickup, to_dropoff)
        self.now = departure
        self.cycle = cycle_used
        self.events = []
        self.lat, self.lng = to_pickup.points[0]
        self.odometer = 0.0
        self.last_fuel = 0.0
        self.shift_start = departure
        self.shift_driving = 0
        self.since_break = 0

    def plan(self):
        if CYCLE_LIMIT - self.cycle <= PRE_TRIP:
            self._restart()
        self._start_shift()
        self._drive(self.legs[0])
        self._stop("pickup", ON_DUTY, PICKUP)
        self._drive(self.legs[1])
        self._stop("dropoff", ON_DUTY, DROPOFF)
        return self.events

    def clocks(self):
        """Minutes left before each limit stops the driver from driving."""
        window_used = (self.now - self.shift_start).total_seconds() / 60
        return {
            "break": DRIVING_BEFORE_BREAK - self.since_break,
            "drive": MAX_DRIVING - self.shift_driving,
            "shift": max(DUTY_WINDOW - window_used, 0),
            "cycle": max(CYCLE_LIMIT - self.cycle, 0),
        }

    def _drive(self, leg):
        ticks = math.ceil(leg.total_minutes / TICK)
        start = self.odometer
        for tick in range(1, ticks + 1):
            lat, lng, miles = leg.position(tick / ticks)
            self._wait_until_legal(start + miles)
            self._drive_tick(lat, lng, start + miles)

    def _wait_until_legal(self, next_odometer):
        while True:
            left = self.clocks()
            if min(left["drive"], left["shift"], left["cycle"]) <= 0:
                self._rest()
            elif left["break"] <= 0:
                self._stop("break", OFF_DUTY, BREAK)
            elif next_odometer - self.last_fuel > FUEL_RANGE_MILES:
                self._stop("fuel", ON_DUTY, FUEL_STOP)
                self.last_fuel = self.odometer
            else:
                return

    def _drive_tick(self, lat, lng, odometer):
        start = self.now
        clocks = self.clocks()
        self.now += timedelta(minutes=TICK)
        miles = odometer - self.odometer
        last = self.events[-1]
        # Driving is split at midnight so each piece belongs to one log sheet.
        if last.kind == "drive" and last.end == start and start.time() != time.min:
            last.end = self.now
            last.miles += miles
        else:
            self.events.append(
                Event(
                    "drive",
                    DRIVING,
                    start,
                    self.now,
                    self.lat,
                    self.lng,
                    self.odometer,
                    miles,
                    clocks=clocks,
                )
            )
        self.lat, self.lng, self.odometer = lat, lng, odometer
        self.cycle += TICK
        self.shift_driving += TICK
        self.since_break += TICK

    def _stop(self, kind, status, minutes):
        start = self.now
        clocks = self.clocks()
        self.now += timedelta(minutes=minutes)
        self.events.append(
            Event(kind, status, start, self.now, self.lat, self.lng, self.odometer, clocks=clocks)
        )
        if status == ON_DUTY:
            self.cycle += minutes
        # Every stop lasts at least 30 minutes, so it also counts as the driving break.
        self.since_break = 0

    def _rest(self):
        if CYCLE_LIMIT - self.cycle <= PRE_TRIP:
            self._restart()
        else:
            self._stop("rest", SLEEPER, DAILY_REST)
        self._start_shift()

    def _restart(self):
        self._stop("restart", OFF_DUTY, CYCLE_RESTART)
        self.cycle = 0

    def _start_shift(self):
        self.shift_start = self.now
        self.shift_driving = 0
        self._stop("pre_trip", ON_DUTY, PRE_TRIP)
