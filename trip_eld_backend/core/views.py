from django.utils import timezone
from rest_framework.decorators import api_view
import pprint
from rest_framework.response import Response
from rest_framework import status, generics

from core.transformer import StopEvent, Transformer
from .serializers import TripPlannerSerializer
import openrouteservice as ors
from openrouteservice import exceptions
from django.conf import settings
from typing import TypedDict, Tuple, List
from concurrent.futures import ThreadPoolExecutor, as_completed

Coords = Tuple[float, float]


class RoutingParams(TypedDict):
    current_coords: Coords
    pickup_coords: Coords
    dropoff_coords: Coords
    current_cycle_used: int


ors_client = ors.Client(key=settings.ORS_API_KEY)


class TripPlannerView(generics.CreateAPIView):
    serializer_class = TripPlannerSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["ors_client"] = ors_client
        return ctx

    def get_directions(self, routing_params: RoutingParams):
        coords = (
            routing_params["current_coords"],
            routing_params["pickup_coords"],
            routing_params["dropoff_coords"],
        )
        return ors_client.directions(coords, profile="driving-hgv")

    def _geocode_single_stop(
        self, ors_client: ors.Client, stop: StopEvent
    ) -> Tuple[StopEvent, str]:
        """Performs a single reverse geocode API call for a stop event."""
        coords = tuple(stop["location"])
        lon, lat = coords[0], coords[1]

        try:
            response = ors_client.pelias_reverse(point=(lon, lat), size=1)

            if response and response.get("features"):
                address = response["features"][0]["properties"].get(
                    "label", "Address not found"
                )
                return stop, address

            return stop, "No address features found"

        except exceptions.ApiError as e:
            print(f"ORS API Error reverse geocoding {coords}: {e}")
            return stop, "Geocoding failed (API Error)"
        except Exception as e:
            print(f"General Error reverse geocoding {coords}: {e}")
            return stop, "Geocoding failed (General Error)"

    def add_address_stops(self, stops: List[StopEvent]):
        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_stop_index = {
                executor.submit(self._geocode_single_stop, ors_client, stop): i
                for i, stop in enumerate(stops)
            }

            for future in as_completed(future_to_stop_index):
                stop_index = future_to_stop_index[future]
                try:
                    original_stop, address = future.result()
                    stops[stop_index]["address"] = address
                    print(f"Geocoded {original_stop['location']} -> {address}")
                except Exception as exc:
                    print(
                        f"Stop at index {stop_index} failed to retrieve result: {exc}"
                    )
                    stops[stop_index]["address"] = "Geocoding Error"

    def create(self, request, *args, **kwargs):
        request_timestamp = timezone.now()
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            current_coords = serializer.context.get("current_location_coords")
            pickup_coords = serializer.context.get("pickup_location_coords")
            dropoff_coords = serializer.context.get("dropoff_location_coords")
            routing_params = {
                "current_coords": current_coords,
                "pickup_coords": pickup_coords,
                "dropoff_coords": dropoff_coords,
                "current_cycle_used": serializer.validated_data["current_cycle_used"],
            }
            directions = self.get_directions(routing_params)
            pprint.pprint(directions)
            transformer = Transformer(
                directions, routing_params["current_cycle_used"], request_timestamp
            )
            result = transformer.transform()

            # if "stops" in result and len(result["stops"]) > 0:
            #     self.add_address_stops(result["stops"])

            routing_params["directions"] = result
            routing_params["coordinates"] = transformer.geometry
            return Response(routing_params, status=status.HTTP_200_OK)
