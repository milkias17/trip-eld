import math
from shapely import LineString
from typing import List, Tuple

LatLng = Tuple[float, float]


def point_along_line(coords: List[LatLng], target_m: float) -> LatLng:
    route_line = LineString(coords)
    target_point = route_line.interpolate(target_m)
    return (target_point.x, target_point.y)
