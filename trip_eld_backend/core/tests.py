import pytest
from typing import Dict, Any, List, Tuple

from core.transformer import (
    Transformer,
    BREAK_DURATION,
    TEN_HOUR_REST,
    PICKUP_DROPOFF_SERVICE,
)


def make_directions(
    steps: List[Dict[str, Any]], way_points: List[int]
) -> Dict[str, Any]:
    """
    Build a minimal directions dict matching the structure expected by Transformer.
    - steps: list of step dicts (distance, duration, way_points)
    - way_points: route way_points list (e.g. [0, 5, 10])
    """
    total_duration = sum(float(s.get("duration", 0.0)) for s in steps)
    return {
        "routes": [
            {
                "summary": {
                    "distance": sum(float(s.get("distance", 0.0)) for s in steps),
                    "duration": total_duration,
                },
                "segments": [
                    {
                        "distance": sum(float(s.get("distance", 0.0)) for s in steps),
                        "duration": total_duration,
                        "steps": steps,
                    }
                ],
                "geometry": "encoded_polyline_placeholder",
                "way_points": way_points,
            }
        ],
        "metadata": {"query": {"coordinates": [[-122.0, 37.0] for _ in way_points]}},
    }


@pytest.fixture(autouse=True)
def patch_decode_polyline(monkeypatch):
    """
    Provide a deterministic decode_polyline that returns coordinates for indices used in tests.
    For example, if tests refer to waypoint indices 0..N, we return N+1 coordinates.
    """

    def fake_decode_polyline(encoded):
        coords = [[-122.0 + i * 0.001, 37.0 + i * 0.001] for i in range(200)]
        return {"coordinates": coords}

    monkeypatch.setattr(
        "openrouteservice.convert.decode_polyline", fake_decode_polyline
    )
    yield


def test_no_hos_needed():
    """
    No HOS breaks/rests required: total driving << 8 hours.
    Expect:
      - no stops inserted
      - hos_events contain only drive events (and service if any)
      - itinerary_total_seconds equals original summary.duration
    """
    steps = [
        {
            "distance": 1000,
            "duration": 1800,
            "type": 1,
            "instruction": "Step 1",
            "way_points": [0, 1],
        },
        {
            "distance": 2000,
            "duration": 1800,
            "type": 1,
            "instruction": "Step 2",
            "way_points": [1, 2],
        },
    ]
    directions = make_directions(steps, way_points=[0, 2])

    t = Transformer(directions, used_cycle=0)
    out = t.transform()

    assert "stops" in out
    assert len(out["stops"]) == 0, "No stops should be inserted for short routes"
    assert "hos_events" in out
    drive_events = [e for e in out["hos_events"] if e["type"] == "drive"]
    assert len(drive_events) == 2
    assert out["itinerary_total_seconds"] == int(
        out["routes"][0]["summary"]["duration"]
    )


def test_insert_30min_break_before_step_exceeding_8h():
    """
    Step 1: 7.5 hours
    Step 2: 1 hour -> would push cumulative driving over 8h (trigger 30-min break)
    Expect:
      - a single 'break' stop inserted before step 2
      - itinerary total includes the 30-min break
      - break event occurs before the second drive event in hos_events
    """
    step1 = {
        "distance": 100000,
        "duration": 7.5 * 3600,
        "type": 1,
        "instruction": "Long drive 1",
        "way_points": [0, 1],
    }
    step2 = {
        "distance": 100000,
        "duration": 1.0 * 3600,
        "type": 1,
        "instruction": "Drive 2",
        "way_points": [1, 2],
    }
    directions = make_directions([step1, step2], way_points=[0, 2])

    t = Transformer(directions, used_cycle=0)
    out = t.transform()

    breaks = [s for s in out["stops"] if s["type"] == "break"]
    assert len(breaks) == 1, f"Expected one 30-min break; found {len(breaks)}"
    assert breaks[0]["duration_seconds"] == BREAK_DURATION

    orig = int(out["routes"][0]["summary"]["duration"])
    assert out["itinerary_total_seconds"] == orig + BREAK_DURATION

    hos = out["hos_events"]
    idx_break = next(i for i, e in enumerate(hos) if e["type"] == "break")
    drive_indices = [i for i, e in enumerate(hos) if e["type"] == "drive"]
    assert len(drive_indices) >= 2
    assert idx_break < drive_indices[1]


def test_insert_10h_rest_before_step_exceeding_11h():
    """
    Step 1: 10 hours
    Step 2: 2 hours -> would push cumulative driving over 11h => require 10h rest at previous step boundary
    Expect:
      - a 'rest' stop inserted prior to step 2
      - the rest duration equals TEN_HOUR_REST
      - rest appears before the second drive
      - after rest, the next drive event's duration equals step2 duration
    """
    step1 = {
        "distance": 360000,
        "duration": 10 * 3600,
        "type": 1,
        "instruction": "10h drive",
        "way_points": [0, 1],
    }
    step2 = {
        "distance": 72000,
        "duration": 2 * 3600,
        "type": 1,
        "instruction": "2h drive",
        "way_points": [1, 2],
    }
    directions = make_directions([step1, step2], way_points=[0, 2])

    t = Transformer(directions, used_cycle=0)
    out = t.transform()

    rests = [s for s in out["stops"] if s["type"] == "rest"]
    assert len(rests) == 1, "Expected one 10-hour rest inserted"
    assert rests[0]["duration_seconds"] == TEN_HOUR_REST

    hos = out["hos_events"]
    rest_idx = next(i for i, e in enumerate(hos) if e["type"] == "rest")
    drive_indices = [i for i, e in enumerate(hos) if e["type"] == "drive"]
    assert drive_indices and len(drive_indices) >= 2
    assert rest_idx < drive_indices[1]

    second_drive_event = hos[drive_indices[1]]
    assert second_drive_event["duration_seconds"] == int(step2["duration"])


def test_service_zero_distance_step_inserts_service_and_advances_elapsed():
    """
    If a step has distance == 0.0, it should be treated as service (pickup/dropoff) and
    a 1h service stop should be recorded and seconds_elapsed advanced accordingly.
    """
    step1 = {
        "distance": 5000,
        "duration": 1800,
        "type": 1,
        "instruction": "Drive 1",
        "way_points": [0, 1],
    }
    step2 = {
        "distance": 0.0,
        "duration": 0.0,
        "type": 0,
        "instruction": "Service",
        "way_points": [1, 1],
    }
    step3 = {
        "distance": 5000,
        "duration": 1800,
        "type": 1,
        "instruction": "Drive 2",
        "way_points": [1, 2],
    }

    directions = make_directions([step1, step2, step3], way_points=[0, 2])
    t = Transformer(directions, used_cycle=0)
    out = t.transform()

    services = [s for s in out["stops"] if s["type"] == "service"]
    assert len(services) == 1, "Expected exactly one service stop"
    assert services[0]["duration_seconds"] == PICKUP_DROPOFF_SERVICE

    orig = int(out["routes"][0]["summary"]["duration"])
    assert out["itinerary_total_seconds"] == orig + PICKUP_DROPOFF_SERVICE


def test_seconds_elapsed_increases_for_breaks_and_rests():
    """
    Confirm that seconds_elapsed increases when breaks/re-sets are added by validating
    time_from_start ordering and expected time offsets.
    """
    step_a = {
        "distance": 100000,
        "duration": 7 * 3600,
        "type": 1,
        "instruction": "A",
        "way_points": [0, 1],
    }
    step_b = {
        "distance": 100000,
        "duration": 1.5 * 3600,
        "type": 1,
        "instruction": "B",
        "way_points": [1, 2],
    }
    step_c = {
        "distance": 100000,
        "duration": 10 * 3600,
        "type": 1,
        "instruction": "C",
        "way_points": [2, 3],
    }
    directions = make_directions([step_a, step_b, step_c], way_points=[0, 3])

    t = Transformer(directions, used_cycle=0)
    out = t.transform()

    hos = out["hos_events"]
    break_ev = next(e for e in hos if e["type"] == "break")
    rest_ev = next(e for e in hos if e["type"] == "rest")

    assert break_ev["time_from_start_seconds"] >= 25200
    expected_min_rest_time = (
        break_ev["time_from_start_seconds"] + BREAK_DURATION + int(step_b["duration"])
    )
    assert rest_ev["time_from_start_seconds"] >= expected_min_rest_time

    total_stop_durations = sum(s["duration_seconds"] for s in out["stops"])
    assert out["itinerary_total_seconds"] == int(
        out["routes"][0]["summary"]["duration"]
    ) + int(total_stop_durations)
