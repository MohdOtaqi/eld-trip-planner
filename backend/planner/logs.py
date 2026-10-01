from datetime import datetime, time, timedelta

from .hos import CYCLE_LIMIT, DRIVING, OFF_DUTY, ON_DUTY, SLEEPER

DAY = 24 * 60


def build_daily_logs(events, cycle_used):
    """Split the trip into one log sheet per calendar day, midnight to midnight."""
    first = events[0].start.date()
    last = (events[-1].end - timedelta(minutes=1)).date()
    cycle = cycle_used
    logs = []

    for offset in range((last - first).days + 1):
        day = first + timedelta(days=offset)
        day_start = datetime.combine(day, time.min)
        day_end = day_start + timedelta(days=1)

        entries, remarks = [], []
        totals = {OFF_DUTY: 0, SLEEPER: 0, DRIVING: 0, ON_DUTY: 0}
        miles = 0.0
        origin = destination = None

        def add_entry(status, start, end):
            if end <= start:
                return
            totals[status] += end - start
            if entries and entries[-1]["status"] == status:
                entries[-1]["end"] = end
            else:
                entries.append({"status": status, "start": start, "end": end})

        if day == first:
            add_entry(OFF_DUTY, 0, _minute_of_day(events[0].start, day_start))

        for i, event in enumerate(events):
            if event.end <= day_start or event.start >= day_end:
                continue
            start = _minute_of_day(max(event.start, day_start), day_start)
            end = _minute_of_day(min(event.end, day_end), day_start)
            add_entry(event.status, start, end)

            origin = origin or event.place
            destination = event.place
            if event.status in (DRIVING, ON_DUTY):
                cycle += end - start

            if event.kind == "drive":
                miles += event.miles
                if i + 1 < len(events):
                    destination = events[i + 1].place
                continue

            if event.kind == "restart" and event.end <= day_end:
                cycle = 0
            if remarks and remarks[-1]["end"] == start and remarks[-1]["place"] == event.place:
                remarks[-1]["end"] = end
                remarks[-1]["kinds"].append(event.kind)
            else:
                remarks.append({"start": start, "end": end, "place": event.place, "kinds": [event.kind]})

        if day == last:
            add_entry(OFF_DUTY, entries[-1]["end"], DAY)

        logs.append(
            {
                "date": day.isoformat(),
                "from": origin,
                "to": destination,
                "miles": round(miles),
                "entries": entries,
                "totals": {status: minutes / 60 for status, minutes in totals.items()},
                "remarks": remarks,
                "recap": {
                    "on_duty_today": (totals[DRIVING] + totals[ON_DUTY]) / 60,
                    "cycle_used": cycle / 60,
                    "cycle_available": max(CYCLE_LIMIT - cycle, 0) / 60,
                },
            }
        )

    return logs


def _minute_of_day(moment, day_start):
    return int((moment - day_start).total_seconds() // 60)
