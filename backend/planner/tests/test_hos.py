from datetime import datetime, timedelta

from django.test import SimpleTestCase

from planner import hos
from planner.logs import build_daily_logs
from planner.routing import Leg

DEPARTURE = datetime(2026, 3, 2, 6, 0)


def straight_leg(miles, mph=60):
    return Leg([(40.0, -100.0), (40.0, -100.0 + miles / 53)], [0.0, miles], [0.0, miles / mph * 60])


def plan(to_pickup, to_dropoff, cycle_hours=0, departure=DEPARTURE):
    planner = hos.TripPlanner(
        straight_leg(to_pickup), straight_leg(to_dropoff), departure, cycle_hours * 60
    )
    return planner.plan()


def kinds(events):
    return [e.kind for e in events]


class TripPlannerTests(SimpleTestCase):
    def assert_legal(self, events, cycle_hours=0):
        """Replay the log and check all driving against the HOS limits."""
        cycle = cycle_hours * 60
        shift_start = events[0].start
        shift_driving = since_break = 0
        since_fuel = 0.0

        for previous, event in zip([None, *events], events):
            if previous:
                self.assertEqual(previous.end, event.start, "log has a gap")

            if event.kind in ("rest", "restart"):
                minimum = hos.CYCLE_RESTART if event.kind == "restart" else hos.DAILY_REST
                self.assertGreaterEqual(event.minutes, minimum)
                shift_start, shift_driving = event.end, 0
                if event.kind == "restart":
                    cycle = 0
            if event.status != hos.DRIVING and event.minutes >= hos.BREAK:
                since_break = 0
            if event.kind == "fuel":
                since_fuel = 0.0
            if event.status in (hos.DRIVING, hos.ON_DUTY):
                cycle += event.minutes

            if event.status == hos.DRIVING:
                shift_driving += event.minutes
                since_break += event.minutes
                since_fuel += event.miles
                self.assertLessEqual(shift_driving, hos.MAX_DRIVING)
                self.assertLessEqual(since_break, hos.DRIVING_BEFORE_BREAK)
                self.assertLessEqual(event.end - shift_start, timedelta(minutes=hos.DUTY_WINDOW))
                self.assertLessEqual(cycle, hos.CYCLE_LIMIT)
                self.assertLessEqual(since_fuel, hos.FUEL_RANGE_MILES)

    def test_short_trip_needs_no_breaks(self):
        events = plan(60, 180)
        self.assertEqual(kinds(events), ["pre_trip", "drive", "pickup", "drive", "dropoff"])
        self.assertEqual([e.minutes for e in events], [30, 60, 60, 180, 60])
        self.assertEqual(events[-1].end, DEPARTURE + timedelta(hours=6, minutes=30))

    def test_break_after_eight_hours_of_driving(self):
        events = plan(0, 600)
        self.assertEqual(kinds(events), ["pre_trip", "pickup", "drive", "break", "drive", "dropoff"])
        self.assertEqual(events[2].minutes, 480)
        self.assertEqual(events[3].status, hos.OFF_DUTY)

    def test_pickup_counts_as_the_driving_break(self):
        events = plan(300, 300)
        self.assertNotIn("break", kinds(events))

    def test_rest_after_eleven_hours_of_driving(self):
        events = plan(0, 720)
        self.assertEqual(
            kinds(events),
            ["pre_trip", "pickup", "drive", "break", "drive", "rest", "pre_trip", "drive", "dropoff"],
        )
        rest = events[5]
        self.assertEqual(rest.status, hos.SLEEPER)
        self.assertEqual(rest.minutes, 600)
        self.assertEqual(sum(e.minutes for e in events[:5] if e.kind == "drive"), 660)

    def test_fourteen_hour_window_stops_driving(self):
        # The shift began six hours before departure, so the window closes after 8 more.
        planner = hos.TripPlanner(straight_leg(0), straight_leg(700), DEPARTURE, 0)
        planner._start_shift()
        planner.shift_start -= timedelta(hours=6)
        planner._drive(planner.legs[1])
        rest = next(e for e in planner.events if e.kind == "rest")
        self.assertEqual(rest.start, DEPARTURE + timedelta(hours=8))

    def test_clocks_run_down_and_reset(self):
        events = plan(0, 720)
        first_drive, short_break, second_drive, rest, pre_trip = events[2:7]
        self.assertEqual(first_drive.clocks, {"break": 480, "drive": 660, "shift": 750, "cycle": 4110})
        self.assertEqual(short_break.clocks["break"], 0)
        self.assertEqual(second_drive.clocks["break"], 480)
        self.assertEqual(rest.clocks["drive"], 0)
        self.assertEqual(pre_trip.clocks, {"break": 480, "drive": 660, "shift": 840, "cycle": 3450})

    def test_fuel_at_least_every_thousand_miles(self):
        events = plan(100, 2400)
        fuel_stops = [e for e in events if e.kind == "fuel"]
        self.assertEqual(len(fuel_stops), 2)
        self.assertLessEqual(fuel_stops[0].odometer, 1000)
        self.assertGreater(fuel_stops[0].odometer, 950)
        self.assertLessEqual(fuel_stops[1].odometer - fuel_stops[0].odometer, 1000)
        self.assertEqual(fuel_stops[0].status, hos.ON_DUTY)

    def test_cycle_limit_forces_a_restart(self):
        events = plan(100, 900, cycle_hours=60)
        restart = next(e for e in events if e.kind == "restart")
        self.assertEqual(restart.minutes, 34 * 60)
        self.assertEqual(restart.status, hos.OFF_DUTY)
        self.assert_legal(events, cycle_hours=60)

    def test_exhausted_cycle_restarts_before_leaving(self):
        events = plan(50, 50, cycle_hours=70)
        self.assertEqual(kinds(events)[:2], ["restart", "pre_trip"])
        self.assertEqual(events[1].start, DEPARTURE + timedelta(hours=34))

    def test_long_trips_stay_legal(self):
        for to_pickup, to_dropoff, cycle, hour in [
            (967, 1437, 20, 6),
            (30, 2800, 0, 22),
            (450, 450, 45, 13),
            (1200, 1900, 65.5, 0),
            (0, 3100, 69, 9),
        ]:
            with self.subTest(to_pickup=to_pickup, to_dropoff=to_dropoff, cycle=cycle):
                events = plan(to_pickup, to_dropoff, cycle, DEPARTURE.replace(hour=hour))
                self.assert_legal(events, cycle)
                driven = sum(e.miles for e in events)
                self.assertAlmostEqual(driven, to_pickup + to_dropoff, places=3)
                self.assertEqual(kinds(events).count("pickup"), 1)
                self.assertEqual(events[-1].kind, "dropoff")


class DailyLogTests(SimpleTestCase):
    def test_each_sheet_covers_24_hours(self):
        events = plan(967, 1437, 20)
        logs = build_daily_logs(events, 20 * 60)
        self.assertGreaterEqual(len(logs), 4)
        for log in logs:
            self.assertEqual(sum(log["totals"].values()), 24)
            self.assertEqual(log["entries"][0]["start"], 0)
            self.assertEqual(log["entries"][-1]["end"], 1440)
            for a, b in zip(log["entries"], log["entries"][1:]):
                self.assertEqual(a["end"], b["start"])
                self.assertNotEqual(a["status"], b["status"])
        self.assertAlmostEqual(sum(log["miles"] for log in logs), 2404, delta=3)

    def test_first_sheet_starts_off_duty_until_departure(self):
        logs = build_daily_logs(plan(60, 180), 0)
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0]["entries"][0], {"status": hos.OFF_DUTY, "start": 0, "end": 360})
        self.assertEqual(logs[0]["entries"][-1]["status"], hos.OFF_DUTY)
        self.assertEqual(logs[0]["totals"][hos.DRIVING], 4)
        self.assertEqual(logs[0]["totals"][hos.ON_DUTY], 2.5)
        self.assertEqual(logs[0]["miles"], 240)

    def test_recap_tracks_the_cycle(self):
        logs = build_daily_logs(plan(0, 720), 20 * 60)
        self.assertEqual(logs[0]["recap"]["on_duty_today"], 12.5)
        self.assertEqual(logs[0]["recap"]["cycle_used"], 32.5)
        self.assertEqual(logs[0]["recap"]["cycle_available"], 37.5)

    def test_recap_resets_after_a_restart(self):
        events = plan(50, 50, cycle_hours=70)
        logs = build_daily_logs(events, 70 * 60)
        self.assertEqual(logs[0]["recap"]["cycle_available"], 0)
        self.assertLess(logs[-1]["recap"]["cycle_used"], 5)

    def test_rest_and_pre_trip_share_one_remark(self):
        logs = build_daily_logs(plan(0, 720), 0)
        remark = logs[1]["remarks"][0]
        self.assertEqual(remark["kinds"], ["rest", "pre_trip"])
        self.assertEqual(remark["start"], 0)
