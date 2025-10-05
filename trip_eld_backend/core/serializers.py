from typing import Iterable
from rest_framework import serializers
import openrouteservice as ors
from django.conf import settings
from rest_framework.exceptions import ValidationError
from concurrent.futures import ThreadPoolExecutor, as_completed


class LatLngTupleField(serializers.Field):
    def to_representation(self, value) -> tuple[float, float]:
        return value

    def to_internal_value(self, data) -> tuple[float, float]:
        if (
            not isinstance(data, Iterable)
            or len(data) != 2
            or any(not isinstance(v, (int, float)) for v in data)
        ):
            raise serializers.ValidationError("Expected [lon, lat] tuple of floats")
        try:
            return float(data[0]), float(data[1])
        except (ValueError, TypeError):
            raise serializers.ValidationError("Both coordinates must convert to float")


class TripPlannerSerializer(serializers.Serializer):
    current_location = LatLngTupleField()
    pickup_location = LatLngTupleField()
    dropoff_location = LatLngTupleField()
    current_cycle_used = serializers.IntegerField(min_value=0)

    def __init__(self, instance=None, data=None, **kwargs):
        super().__init__(instance, data, **kwargs)
        if "ors_client" in kwargs.get("context"):
            self._ors_client = kwargs.get("context")["ors_client"]
        else:
            try:
                self._ors_client = ors.Client(key=settings.ORS_API_KEY)
            except Exception:
                self._ors_client = None

    def geocode_location(self, location_name):
        if not location_name or not location_name.strip():
            raise ValidationError("Location name cannot be empty")

        if self._ors_client is None:
            raise ValidationError("OpenRouteService client not available")

        try:
            results = self._ors_client.pelias_search(text=location_name)
            if not results or not results.get("features"):
                raise ValidationError(f"Location '{location_name}' not found")
            coordinates = results["features"][0]["geometry"]["coordinates"]
            return (coordinates[0], coordinates[1])
        except Exception as e:
            raise ValidationError(f"Geocoding failed for '{location_name}': {str(e)}")

    def validate_current_cycle_used(self, value):
        if value < 0:
            raise serializers.ValidationError("Current Cycle cannot be negative.")

        return value * 60 * 60

    # def validate_current_location(self, value):
    #     """Validate current location by geocoding it."""
    #     coords = self.geocode_location(value)
    #     self.context["current_location_coords"] = coords
    #     return value
    #
    # def validate_pickup_location(self, value):
    #     """Validate pickup location by geocoding it."""
    #     coords = self.geocode_location(value)
    #     self.context["pickup_location_coords"] = coords
    #     return value
    #
    # def validate_dropoff_location(self, value):
    #     """Validate dropoff location by geocoding it."""
    #     coords = self.geocode_location(value)
    #     self.context["dropoff_location_coords"] = coords
    #     return value

    def validate(self, data):
        """Perform cross-field validation and geocode locations concurrently."""

        locations = {
            "current_location": data["current_location"],
            "pickup_location": data["pickup_location"],
            "dropoff_location": data["dropoff_location"],
        }

        if len(set(locations.values())) != 3:
            raise ValidationError(
                "Current, pickup, and dropoff locations must all be different"
            )

        # coords_results = {}
        # errors = {}

        # coords_results = {
        #     "current_location": [-122.331537, 47.673455],
        #     "pickup_location": [-104.985798, 39.740959],
        #     "dropoff_location": [-80.210268, 25.766368],
        # }

        # coords_results = {
        #     "current_location": [-122.416336, 37.80671],
        #     "pickup_location": [-122.331537, 47.673455],
        #     "dropoff_location": [-122.481106, 37.769134],
        # }

        # with ThreadPoolExecutor(max_workers=3) as executor:
        #     future_to_field = {
        #         executor.submit(self.geocode_location, name): field
        #         for field, name in locations.items()
        #     }
        #
        #     for future in as_completed(future_to_field):
        #         field = future_to_field[future]
        #         try:
        #             coords_results[field] = future.result()
        #         except ValidationError as e:
        #             errors[field] = str(e)
        #
        # if errors:
        #     raise ValidationError(errors)

        for field, coords in locations.items():
            self.context[f"{field}_coords"] = coords

        return data
