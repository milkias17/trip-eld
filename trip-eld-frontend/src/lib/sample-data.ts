import type { LatLngTuple } from "leaflet";
import type { Data } from "./lib/types";
import data from "./assets/sampleData.json";

const sampleData = (data as any) as Data;

const stops = sampleData.directions.stops.map((stop) => ({
  ...stop,
  location: stop.location.reverse() as LatLngTuple
}))
sampleData.directions.stops = stops;
sampleData.current_coords.reverse()
sampleData.dropoff_coords.reverse()
sampleData.pickup_coords.reverse()

export { sampleData };
