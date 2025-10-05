// @ts-ignore
import polyline from '@mapbox/polyline';
import { MapPin, Minimize, Maximize, Layers, Clock, Car } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, Tooltip, useMap } from 'react-leaflet';
import type { FullscreenHook } from "../hooks/useFullscreen";
import useFullscreen from "../hooks/useFullscreen";
import { secondsToHourString, toMiles, toHour } from "../lib/utils";
import { FullscreenHandler } from "./FullscreenHandler";
import { Card, MetricCard, ProgressBar } from "./ui-helpers";
import type { Directions, Results } from '../lib/types';
import type { LatLngExpression, LatLngTuple } from 'leaflet';
import L from 'leaflet';
import ELDTimeline from './ELDLogSheets';
import FilterChip from './FilterChip';

function getLeafletBounds(orsBbox: number[]): LatLngExpression[] {
  const [minLon, minLat, maxLon, maxLat] =
    orsBbox.length === 6
      ? [orsBbox[0], orsBbox[1], orsBbox[3], orsBbox[4]]
      : orsBbox;

  // Leaflet expects: [[south_lat, west_lon], [north_lat, east_lon]]
  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ];
}

const MapFitter = ({ orsBbox }: { orsBbox: number[] }) => {
  const map = useMap();

  useEffect(() => {
    if (orsBbox && orsBbox.length >= 4) {
      try {
        const boundsArray = getLeafletBounds(orsBbox);

        const bounds = L.latLngBounds(boundsArray);

        map.fitBounds(bounds, {
          padding: [20, 20]
        });

      } catch (error) {
        console.error("Error setting map bounds:", error);
      }
    }
  }, [map, orsBbox]);

  return null;
};

type ModalProps = {
  showStopsModal: boolean;
  setShowStopsModal: (cond: boolean) => void;
  directions: Directions
}

type StopTypes = "break" | "rest" | "service" | "fuel"

const StopsModal: React.FC<ModalProps> = ({ showStopsModal, setShowStopsModal, directions }) => {
  const [filters, setFilters] = useState<{ break: boolean; rest: boolean; service: boolean; fuel: boolean }>({
    break: false,
    fuel: false,
    rest: false,
    service: false
  });
  const activeFilterKeys = useMemo(() => {
    return (Object.keys(filters) as Array<keyof typeof filters>).filter(
      (k) => filters[k]
    );
  }, [filters]);

  const [stops, setStops] = useState(directions.stops);

  useEffect(() => {
    let tmpStops = directions.stops;
    if (activeFilterKeys.length === 0) {
      setStops(tmpStops);
      return;
    }

    tmpStops = tmpStops.filter((val) => {
      const t = val.type
      return activeFilterKeys.includes(t);
    });
    setStops(tmpStops);
  }, [directions, filters])

  function handleToggle(value: StopTypes, next: boolean) {
    setFilters((prev) => ({
      ...prev,
      [value]: next
    }))
  }

  useEffect(() => {
    if (!showStopsModal) document.body.style.overflow = "unset";

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "unset"
    }
  }, [showStopsModal])

  if (!showStopsModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
      <div className="absolute inset-0 bg-black/60" onClick={() => setShowStopsModal(false)} />
      <div className="relative w-full max-w-3xl max-h-[85vh] overflow-auto bg-gray-900 border border-gray-700 rounded-lg p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-indigo-300">All Mandatory Stops ({directions.stops.length})</h3>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-400">Quick filter:</div>
            <form>
              <FilterChip value="break" label='Break' selected={filters.break} onToggle={handleToggle} />
              <FilterChip value="rest" label='Rest' selected={filters.rest} onToggle={handleToggle} />
              <FilterChip value="service" label='Service' selected={filters.service} onToggle={handleToggle} />
              <FilterChip value="fuel" label='Fuel' selected={filters.fuel} onToggle={handleToggle} />
            </form>
            <button onClick={() => setShowStopsModal(false)} className="text-sm px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded-md text-white">Close</button>
          </div>
        </div>

        <ul className="space-y-3">
          {stops.map((stop, idx) => (
            <li key={idx} className="p-3 bg-gray-800 rounded border border-gray-700 flex items-start gap-3">
              <div className={`text-xs font-semibold px-2 py-1 rounded ${stop.type === 'rest' ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>{stop.type}</div>
              <div className="flex-1">
                <div className="font-medium text-gray-100">{stop.reason}</div>
                <div className="text-xs text-gray-400">{stop.location}</div>
                <div className="text-xs text-gray-400 mt-1">Time from start: {secondsToHourString(stop.time_from_start_seconds)} • Duration: {secondsToHourString(stop.duration_seconds)}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>

  )
};


type RouteAndSummaryProps = {
  coordinates: string;
  directions: Directions;
  current_coords: LatLngTuple;
}

export const RouteAndSummary: React.FC<RouteAndSummaryProps> = ({ coordinates: co, directions, current_coords }) => {
  const { elementRef, isFullscreen, toggleFullscreen }: FullscreenHook = useFullscreen();

  const coordinates = polyline.decode(co);
  const [showStopsModal, setShowStopsModal] = useState(false);

  console.log(directions.stops.length);

  return (
    <div className="space-y-6">
      {showStopsModal && <StopsModal showStopsModal={showStopsModal} setShowStopsModal={setShowStopsModal} directions={directions} />}
      <Card title="Optimal Route Map" icon={MapPin}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 h-80 md:h-96 bg-indigo-900/10 rounded-lg overflow-hidden border border-dashed border-indigo-700 relative">
            {!showStopsModal && (
              <div
                ref={elementRef as React.RefObject<HTMLDivElement>}
                className={`h-full w-full`}
                style={{ position: 'relative' }}
              >
                <MapContainer className='h-full w-full' center={current_coords} zoom={6} scrollWheelZoom={true}>
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <Marker position={current_coords}>
                    <Popup>Start Position</Popup>
                    <Tooltip>Start Position</Tooltip>
                  </Marker>

                  {directions.bbox && (
                    <MapFitter orsBbox={directions.bbox} />
                  )}

                  {directions.stops.map((d, idx) => (
                    <Marker key={`${d.location}-${idx}`} position={d.location}>
                      <Popup>{d.reason}</Popup>
                      <Tooltip>{d.reason}</Tooltip>
                    </Marker>
                  ))}

                  <FullscreenHandler isFullscreen={isFullscreen} />

                  <button
                    onClick={toggleFullscreen}
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      zIndex: 1000,
                      background: 'white',
                      border: '2px solid rgba(0,0,0,0.08)',
                      padding: '6px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                    title={isFullscreen ? 'Exit Fullscreen' : 'Toggle Fullscreen'}
                  >
                    {isFullscreen ? <Minimize color='black' size={16} /> : <Maximize color="black" size={16} />}
                  </button>

                  <Polyline positions={coordinates} pathOptions={{ color: 'rgba(56, 189, 248, 0.9)', weight: 5 }} />
                </MapContainer>
              </div>
            )}
          </div>

          <div className="w-full md:w-80 space-y-4">
            <MetricCard title="Total Distance" value={<><span className="text-3xl">{toMiles(directions.hos_summary.total_distance)}</span><span className="text-sm text-gray-400 ml-1"> mi</span></>} subtitle={`${directions.stops.length} stops suggested`} icon={Layers} />

            <MetricCard title="Est. Driving Time" value={<>{secondsToHourString(directions.hos_summary.original_travel_seconds)}</>} subtitle={`Itinerary: ${secondsToHourString(directions.hos_summary.total_itinerary_seconds ?? 0)}`} icon={Clock} />

            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <p className="text-sm text-indigo-300 font-medium">Cycle Status</p>
              <div className="mt-2 space-y-2">
                <ProgressBar label={`Cycle used (end)`} value={toHour(directions.hos_summary.cycles_used_end)} max={70} compact />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Remaining</span>
                  <span className="text-sm font-mono text-indigo-300">{toHour(directions.hos_summary.cycles_remaining)} hrs</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 text-sm">
              <p className="text-xs text-gray-400 mb-2">Mandatory Stops (preview)</p>

              {/* Compact preview (first 3 stops) */}
              <ul className="space-y-2">
                {directions.stops.slice(0, 3).map((stop, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-100">{stop.reason}</div>
                      <div className="text-xs text-gray-400">{stop.location}</div>
                    </div>
                    <div className={`text-xs font-semibold px-2 py-1 rounded ${stop.type === 'rest' ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>{stop.type}</div>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-gray-400">Showing first 3 stops. Full list may be long.</div>
                <button onClick={() => setShowStopsModal(true)} className="text-sm bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-md text-white">View all stops</button>
              </div>
            </div>

          </div>
        </div>
      </Card>

      <div className="w-full">
        <ELDTimeline data={directions.eld} />
      </div>

    </div>
  );
};
