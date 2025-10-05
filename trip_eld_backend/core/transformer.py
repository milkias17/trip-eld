import copy
from datetime import datetime, time, timedelta
from typing import List, Literal, Tuple, Dict, Any, Type
from django.utils import duration
from openrouteservice import convert

from typing import TypedDict, List, Dict, Optional, Tuple, Any

from core.utils import point_along_line

METER_PER_MILE = 1609.344


def get_remaining_time(
    needs_rest: bool,
    needs_30m_break: bool,
    is_over_cycle: bool,
    cumulative: int,
    total_cycle_on_duty: float,
):
    if needs_rest:
        return DRIVE_LIMIT - cumulative

    if needs_30m_break:
        return BREAK_AFTER_DRIVE - cumulative

    if is_over_cycle:
        return CYCLE_DURATION - total_cycle_on_duty


def predict_distance(prev_duration: float, prev_distance: float, new_duration: float):
    if prev_duration == 0:
        return 0
    return (prev_distance * new_duration) / prev_duration


def predict_duration(prev_duration: float, prev_distance: float, new_distance: float):
    if prev_distance == 0:
        return 0
    return (new_distance * prev_duration) / prev_distance


def does_adding_seconds_cross_day(start_dt, seconds_to_add):
    time_delta = timedelta(seconds=seconds_to_add)
    end_dt = start_dt + time_delta

    return start_dt.date() != end_dt.date()


def seconds_until_midnight(start_time: datetime, cur_total: int) -> int:
    current = start_time + timedelta(seconds=cur_total)
    next_midnight = datetime.combine(
        current.date() + timedelta(days=1),
        datetime.min.time(),
        tzinfo=start_time.tzinfo,
    )
    return int((next_midnight - current).total_seconds())


HosEventType = Literal["break", "rest", "service", "drive", "fuel"]

LatLngTuple = Tuple[float, float]


class HosEvent(TypedDict, total=False):
    type: HosEventType
    duration_seconds: int
    distance_meters: Optional[float]
    segment_index: int
    step_index: int
    instruction: Optional[str]
    location: Optional[LatLngTuple]
    reason: Optional[str]
    time_from_start_seconds: int


class StopEvent(TypedDict):
    type: str
    duration_seconds: int
    reason: str
    location: list[float, float]
    time_from_start_seconds: int


class StepDict(TypedDict, total=False):
    distance: float
    duration: float
    type: int
    instruction: str
    name: str
    way_points: List[int]


class SegmentDict(TypedDict, total=False):
    distance: float
    duration: float
    steps: List[StepDict]


class SummaryDict(TypedDict, total=False):
    distance: float
    duration: float


class RouteDict(TypedDict, total=False):
    summary: SummaryDict
    segments: List[SegmentDict]
    bbox: List[float]
    geometry: str
    way_points: List[int]


class QueryDict(TypedDict, total=False):
    coordinates: List[Tuple[float, float]]  # [lon, lat]
    profile: str
    format: str


class EngineDict(TypedDict, total=False):
    version: str
    build_date: str
    graph_date: str


class ServiceDict(TypedDict, total=False):
    attribution: str
    version: str
    timestamp: int


class MetadataDict(TypedDict, total=False):
    attribution: str
    service: str
    timestamp: int
    query: QueryDict
    engine: EngineDict


class DirectionsDict(TypedDict, total=False):
    routes: List[RouteDict]
    metadata: MetadataDict
    bbox: Tuple[float]


ELDEventType = Literal["drive", "off_duty", "on_duty"]


class ELDEvent(TypedDict, total=False):
    event_type: ELDEventType
    remark: str
    time_from_start_seconds: int
    duration_seconds: int


class ELDLog(TypedDict, total=False):
    start_time: datetime
    log_events: List[ELDEvent]
    total_driving: float
    total_off_duty: float
    total_on_duty: float


def hours_to_seconds(hours):
    return hours * 60 * 60


DRIVE_LIMIT = hours_to_seconds(11)
BREAK_AFTER_DRIVE = hours_to_seconds(8)
BREAK_DURATION = 30 * 60
TEN_HOUR_REST = hours_to_seconds(10)
PICKUP_DROPOFF_SERVICE = 60 * 60
CYCLE_DURATION = hours_to_seconds(70)
CYCLE_REST = hours_to_seconds(34)
DISTANCE_LIMIT = 1_000 * METER_PER_MILE


def snap_to_next_day(dt_obj):
    """
    Modifies the input datetime object to the first moment of the next day
    if it is within 30 minutes (inclusive) of midnight.

    :param dt_obj: A timezone-aware datetime object (e.g., from timezone.now()).
    :return: The modified (or original) timezone-aware datetime object.
    """
    THRESHOLD = timedelta(minutes=30)

    next_day_date = dt_obj.date() + timedelta(days=1)

    next_midnight = datetime.combine(
        next_day_date, datetime.min.time(), tzinfo=dt_obj.tzinfo
    )

    time_until_midnight = next_midnight - dt_obj

    if time_until_midnight <= THRESHOLD:
        return next_midnight
    else:
        return dt_obj


def add_event(
    log_events: List[ELDEvent],
    event_type: ELDEventType,
    time_from_start: int,
    duration_seconds: int,
    event_remark: str = None,
):
    if len(log_events) == 0:
        event_dict: ELDEvent = {"event_type": event_type}
        if event_type in ["off_duty", "on_duty"]:
            event_dict["remark"] = event_remark

        event_dict["time_from_start_seconds"] = time_from_start
        event_dict["duration_seconds"] = duration_seconds
        log_events.append(event_dict)
    else:
        prev = log_events[len(log_events) - 1]
        if prev["event_type"] == event_type:
            prev["duration_seconds"] += duration_seconds
        else:
            event_dict: ELDEvent = {"event_type": event_type}
            if event_type in ["off_duty", "on_duty"]:
                event_dict["remark"] = event_remark

            event_dict["time_from_start_seconds"] = time_from_start
            event_dict["duration_seconds"] = duration_seconds
            log_events.append(event_dict)


def add_total_counts(event_type: ELDEventType, eld: ELDLog, duration_seconds: int):
    if event_type == "drive":
        eld["total_driving"] += duration_seconds
    elif event_type == "off_duty":
        eld["total_off_duty"] += duration_seconds
    elif event_type == "on_duty":
        eld["total_on_duty"] += duration_seconds


class Transformer:
    def __init__(
        self, directions: DirectionsDict, used_cycle: int, request_timestamp: datetime
    ) -> None:
        self.initial_time = snap_to_next_day(request_timestamp)
        self.directions = directions
        self.used_cycle = used_cycle
        self.out = copy.deepcopy(directions)
        self.route = self.out["routes"][0]
        self.geometry = self.route["geometry"]
        self.coords = convert.decode_polyline(self.geometry)["coordinates"]
        self.hos_events: List[HosEvent] = []
        self.stops: List[StopEvent] = []
        self.cumulative_driving = 0
        self.consecutive_driving = 0
        self.cumulative_on_duty = 0
        self.total_cycle_on_duty = used_cycle
        self.seconds_elapsed = 0.0
        self.route_waypoints = self.route.get("way_points", [])
        self.cumulative_distance = 0.0

    def get_eld(self):
        if len(self.hos_events) == 0:
            return []

        elds: List[ELDLog] = [
            {
                "start_time": self.initial_time,
                "log_events": [],
                "total_driving": 0,
                "total_off_duty": 0,
                "total_on_duty": 0,
            }
        ]
        cur_total = 0
        for event in self.hos_events:
            n = len(elds) - 1

            event_type = None
            if event["type"] in ["break", "rest"]:
                event_type = "off_duty"
            elif event["type"] in ["service", "fuel"]:
                event_type = "on_duty"
            elif event["type"] == "drive":
                event_type = "drive"

            log_events = elds[n]["log_events"]

            if does_adding_seconds_cross_day(
                elds[n]["start_time"], cur_total + event["duration_seconds"]
            ):
                splittable_seconds = seconds_until_midnight(
                    elds[n]["start_time"], cur_total
                )
                splitted_event = event["duration_seconds"] > splittable_seconds
                new_log_events: List[ELDEvent] = []
                new_start_date = datetime.combine(
                    elds[n]["start_time"].date() + timedelta(days=1),
                    datetime.min.time(),
                    tzinfo=self.initial_time.tzinfo,
                )
                new_eld: ELDLog = {
                    "start_time": new_start_date,
                    "log_events": new_log_events,
                    "total_driving": 0,
                    "total_off_duty": 0,
                    "total_on_duty": 0,
                }
                if splitted_event:
                    ev_seconds = event["duration_seconds"] - splittable_seconds
                    add_event(
                        log_events,
                        event_type,
                        cur_total,
                        splittable_seconds,
                        event.get("reason", None),
                    )
                    add_total_counts(event_type, elds[n], splittable_seconds)
                    add_event(
                        new_log_events,
                        event_type,
                        0,
                        ev_seconds,
                        event.get("reason", None),
                    )
                    add_total_counts(event_type, new_eld, ev_seconds)

                elds.append(new_eld)
                n = len(elds) - 1
                cur_total = 0
                if splitted_event:
                    cur_total = ev_seconds
                    continue
                log_events = new_log_events

            add_event(
                log_events,
                event_type,
                cur_total,
                event["duration_seconds"],
                event.get("reason", None),
            )

            add_total_counts(event_type, elds[n], event["duration_seconds"])
            cur_total += event["duration_seconds"]

        return elds

    def coord_for_waypoint(self, idx: int):
        return self.coords[idx]

    def transform(self):
        for seg_idx, seg in enumerate(self.route.get("segments", [])):
            seg_distance = float(seg.get("distance", 0.0))
            seg_duration = float(seg.get("duration", 0.0))
            for step_idx, step in enumerate(seg.get("steps", [])):
                step_distance = float(step.get("distance", 0.0))
                step_duration = float(step.get("duration", 0.0))
                instruction = step.get("instruction", "")
                way_points = step.get("way_points", [])

                if step_distance == 0.0:
                    if seg_idx == 0:
                        reason = "Pickup Item"
                    else:
                        reason = "Dropoff Item"
                    self.record_service(
                        self.coord_for_waypoint(way_points[1]),
                        seg_idx,
                        step_idx,
                        reason=reason,
                    )
                    continue

                needs_rest = (self.cumulative_driving + step_duration) >= DRIVE_LIMIT
                needs_30m_break = (
                    self.consecutive_driving + step_duration
                ) >= BREAK_AFTER_DRIVE
                is_over_cycle = (
                    self.total_cycle_on_duty + step_duration
                ) >= CYCLE_DURATION

                prev_coord = self.coord_for_waypoint(way_points[0])
                start_idx = way_points[0]
                end_idx = way_points[1]
                segment_coords = self.coords[start_idx : end_idx + 1]

                if needs_rest or needs_30m_break or is_over_cycle:
                    if is_over_cycle:
                        remaining_time = CYCLE_DURATION - self.total_cycle_on_duty
                    elif needs_rest:
                        remaining_time = DRIVE_LIMIT - self.cumulative_driving
                    else:
                        remaining_time = BREAK_AFTER_DRIVE - self.consecutive_driving

                    if remaining_time > 0:
                        duration_after_rest = step_duration - remaining_time
                        remaining_distance = predict_distance(
                            step_duration, step_distance, remaining_time
                        )
                        distance_after_rest = step_distance - remaining_distance
                        self.record_drive(
                            remaining_time,
                            remaining_distance,
                            seg_idx,
                            step_idx,
                            instruction,
                        )
                        step_duration = duration_after_rest
                        step_distance = distance_after_rest
                        prev_coord = point_along_line(
                            segment_coords, remaining_distance
                        )

                if is_over_cycle:
                    self.record_break_or_rest(
                        prev_coord,
                        "rest",
                        CYCLE_REST,
                        "Weekly 70 hour limit reached",
                    )
                elif needs_rest:
                    self.record_break_or_rest(
                        prev_coord,
                        "rest",
                        TEN_HOUR_REST,
                        "10-hour rest required (11h driving limit would be exceeded)",
                    )
                elif needs_30m_break:
                    self.record_break_or_rest(
                        prev_coord,
                        "break",
                        BREAK_DURATION,
                        "30-min break required (8h driving)",
                    )

                needs_fueling = (
                    self.cumulative_distance + step_distance
                ) >= DISTANCE_LIMIT
                if needs_fueling:
                    remaining_distance = DISTANCE_LIMIT - self.cumulative_distance
                    if remaining_distance > 0:
                        distance_after_rest = step_distance - remaining_distance
                        remaining_time = predict_duration(
                            step_duration, step_distance, remaining_distance
                        )
                        duration_after_rest = step_duration - remaining_time
                        self.record_drive(
                            remaining_time,
                            remaining_distance,
                            seg_idx,
                            step_idx,
                            instruction,
                        )
                        step_duration = duration_after_rest
                        step_distance = distance_after_rest
                        prev_coord = point_along_line(
                            segment_coords,
                            remaining_distance,
                        )

                    self.record_break_or_rest(
                        prev_coord,
                        "fuel",
                        BREAK_DURATION,
                        "1,000 miles has been reached, truck needs fueling",
                    )

                self.record_drive(
                    step_duration, step_distance, seg_idx, step_idx, instruction
                )

        travel_seconds = float(self.route.get("summary", {}).get("duration", 0.0))
        total_stop_seconds = sum(s["duration_seconds"] for s in self.stops)
        itinerary_total_seconds = travel_seconds + total_stop_seconds

        res = {
            "bbox": self.directions["bbox"],
            "stops": self.stops,
            "hos_events": self.hos_events,
            "eld": self.get_eld(),
            "itinerary_total_seconds": int(itinerary_total_seconds),
            "hos_summary": {
                "original_travel_seconds": int(travel_seconds),
                "added_stop_seconds": int(total_stop_seconds),
                "total_itinerary_seconds": int(itinerary_total_seconds),
                "total_distance": self.route.get("summary").get("distance"),
                "cycles_used_end": self.total_cycle_on_duty,
                "cycles_remaining": CYCLE_DURATION - self.total_cycle_on_duty,
                "notes": "Stops placed at previous step boundary; 30-min breaks inserted when next step would exceed 8h driving; 10h rest inserted when next step would exceed 11h driving; 1h service at intermediate waypoints.",
            },
        }

        return res

    def record_break_or_rest(
        self,
        at_coord: Tuple[float, float],
        stop_type: str,
        duration_seconds: int,
        reason: str = "break/rest",
    ):
        ev = {
            "type": stop_type,
            "duration_seconds": int(duration_seconds),
            "reason": reason,
            "location": [round(at_coord[0], 6), round(at_coord[1], 6)],
            "time_from_start_seconds": int(self.seconds_elapsed),
        }
        self.hos_events.append(ev)
        self.stops.append(ev)
        self.seconds_elapsed += duration_seconds
        if stop_type == "rest":
            self.cumulative_driving = 0
            self.cumulative_on_duty = 0
            self.consecutive_driving = 0
            if duration_seconds == CYCLE_REST:
                self.total_cycle_on_duty = 0
        elif stop_type == "break":
            self.consecutive_driving = 0
        elif stop_type == "fuel":
            self.consecutive_driving = 0
            self.cumulative_distance = 0
            self.total_cycle_on_duty += duration_seconds

    def record_drive(
        self,
        duration_seconds: float,
        distance_meters: float,
        seg_idx: int,
        step_idx: int,
        instruction: str,
    ):
        event = {
            "type": "drive",
            "duration_seconds": int(duration_seconds),
            "distance_meters": float(distance_meters),
            "segment_index": seg_idx,
            "step_index": step_idx,
            "instruction": instruction,
            "time_from_start_seconds": int(self.seconds_elapsed),
        }
        self.hos_events.append(event)
        self.cumulative_driving += int(duration_seconds)
        self.consecutive_driving += int(duration_seconds)
        self.cumulative_on_duty += int(duration_seconds)
        self.seconds_elapsed += duration_seconds
        self.cumulative_distance += event["distance_meters"]
        self.total_cycle_on_duty += int(duration_seconds)

    def record_service(
        self,
        at_coord: Tuple[float, float],
        seg_idx: int,
        step_idx: int,
        reason="Pickup/Dropoff",
    ):
        event = {
            "type": "service",
            "duration_seconds": PICKUP_DROPOFF_SERVICE,
            "reason": reason,
            "location": [round(at_coord[0], 6), round(at_coord[1], 6)],
            "segment_index": seg_idx,
            "step_index": step_idx,
            "time_from_start_seconds": int(self.seconds_elapsed),
        }
        self.hos_events.append(event)
        self.stops.append(
            {
                "type": "service",
                "location": event["location"],
                "duration_seconds": PICKUP_DROPOFF_SERVICE,
                "reason": reason,
                "time_from_start_seconds": int(self.seconds_elapsed),
            }
        )
        self.cumulative_on_duty += PICKUP_DROPOFF_SERVICE
        self.seconds_elapsed += PICKUP_DROPOFF_SERVICE
        self.total_cycle_on_duty += PICKUP_DROPOFF_SERVICE
        self.consecutive_driving = 0
