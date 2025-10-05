import type { Position } from 'geojson';
import { type LatLngTuple } from 'leaflet';

type DMarker = {
  position: LatLngTuple,
  type: "rest"
}

type DStops = {
  type: "break" | "rest" | "service" | "fuel";
  duration_seconds: number;
  reason: string;
  location: LatLngTuple;
  time_from_start_seconds: number;
  address?: string;
}

type HosEvent = {
  type: "break" | "rest" | "service" | "drive";
  duration_seconds: number;
  distance_meters?: number;
  segment_index: number;
  step_index: number;
  instruction?: string;
  location?: LatLngTuple;
  reason?: string;
  time_from_start_seconds: number;
};

type HosSummary = {
  original_travel_seconds: number;
  added_stop_seconds: number;
  total_itinerary_seconds: number;
  total_distance: number;
  cycles_used_end: number;
  cycles_remaining: number;
  notes: string;
};

export type ELDEvent = {
  event_type: 'drive' | 'off_duty' | 'on_duty' | string;
  remark?: string;
  time_from_start_seconds: number;
  duration_seconds: number;
};

export type ELDLog = {
  start_time: string | Date;
  log_events: ELDEvent[];
  total_driving: number;
  total_off_duty: number;
  total_on_duty: number;
};


export type Directions = {
  bbox: number[];
  stops: DStops[];
  hos_events: HosEvent[];
  itinerary_total_seconds: number;
  hos_summary: HosSummary;
  eld: ELDLog[];
}

export type Data = {
  current_coords: LatLngTuple;
  pickup_coords: LatLngTuple;
  dropoff_coords: LatLngTuple;
  directions: Directions;
  coordinates: string;
  current_cycle_used: number;
}


export interface Inputs {
  currentLocation: Position | null;
  pickupLocation: Position | null;
  dropoffLocation: Position | null;
  cycleUsedHours: number;
}

export interface Stop {
  name: string;
  type: 'Rest' | 'Fuel';
  location: string;
  duration: string;
}

export interface Log {
  day: number;
  driving: number;
  onDuty: number;
  sleep: number;
  shift: string;
  status: string;
}

export interface RouteInfo {
  distanceMiles: number;
  drivingHours: number;
  totalTripDays: number;
  stops: Stop[];
}

export interface CycleSummary {
  startCycleUsed: number;
  endCycleUsed: number;
  cycleRemainingAfterTrip: number;
  logSheetsCount: number;
}

export interface Results {
  routeInfo: RouteInfo;
  cycleSummary: CycleSummary;
  logs: Log[];
}

