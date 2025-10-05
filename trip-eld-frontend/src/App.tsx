import React, { useState, useCallback, type ChangeEvent } from 'react';
import { Truck, MapPin, Loader2, Info } from 'lucide-react';
import "./App.css";
import type { Data, Inputs, Results } from './lib/types';
import { RouteAndSummary } from './components/RouteAndSummary';
import { TripInputForm } from './components/TripInputForm';
import { useMutation } from '@tanstack/react-query';
import { API_URL } from './lib/constants';
import type { LatLngTuple } from 'leaflet';
import type { Position } from 'geojson';

const App: React.FC = () => {
  const [inputs, setInputs] = useState<Inputs>(
    {
      currentLocation: null,
      pickupLocation: null,
      dropoffLocation: null,
      cycleUsedHours: 0
    }
  );

  const [data, setData] = useState<Data | null>(null);
  const [customError, setCustomError] = useState("");


  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_URL}/report/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          current_location: inputs.currentLocation,
          pickup_location: inputs.pickupLocation,
          dropoff_location: inputs.dropoffLocation,
          current_cycle_used: inputs.cycleUsedHours
        })
      })
      if (!response.ok) {
        const json = await response.json();
        throw new Error(`Request failed ${response.status}: ${JSON.stringify(json, null, 2)}`)
      }
      const json = await response.json();
      return json as Data;
    },
    onSuccess: (data) => {
      const stops = data.directions.stops.map((stop) => ({
        ...stop,
        location: stop.location.reverse() as LatLngTuple
      }))
      data.directions.stops = stops;
      data.current_coords.reverse()
      data.dropoff_coords.reverse()
      data.pickup_coords.reverse()
      setData(data);
    },
    onError: (err) => {
      console.error(err);
    }
  })

  function reset() {
    setInputs({
      currentLocation: null,
      pickupLocation: null,
      dropoffLocation: null,
      cycleUsedHours: 0
    })
    setData(null);
  }

  function calculateTrip() {
    if (inputs.currentLocation == null || inputs.pickupLocation == null || inputs.dropoffLocation == null) {
      console.log(JSON.stringify(inputs, null, 2));
      setCustomError("Please fill out all locations in order to generate report")
      return;
    }

    setCustomError("");
    mutate();
  }

  const handleChange = (name: "currentLocation" | "dropoffLocation" | "pickupLocation" | "cycleUsedHours", coordinates: Position | undefined | null) => {
    if (name !== "cycleUsedHours") {
      setInputs(prev => ({
        ...prev,
        [name]: coordinates
      }));
    } else {
      setInputs(prev => ({
        ...prev,
        cycleUsedHours: coordinates != null ? coordinates : 0
      }))
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 font-inter text-white p-6 sm:p-10">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Truck className="w-10 h-10 text-indigo-400" />
            <div>
              <h1 className="text-3xl font-extrabold text-white">HOS Route & ELD Log Generator</h1>
              <p className="text-sm text-gray-400 mt-1">Plan compliant commercial routes and automatically generate daily log sheets — improved layout for fast scanning.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-400">Status</div>
              <div className={`text-sm ${isPending ? 'text-indigo-300' : data ? 'text-green-400' : 'text-gray-400'}`}>{isPending ? 'Calculating...' : data ? 'Ready' : 'Idle'}</div>
            </div>

            <div className="flex items-center bg-gray-800 border border-gray-700 rounded p-2 text-sm text-gray-300">
              <Info className="w-4 h-4 mr-2 text-indigo-300" />
              <div className="text-xs">70hr / 8day rule (property-carrying)</div>
            </div>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 sticky top-6">
          <TripInputForm inputs={inputs} handleChange={handleChange} calculateTrip={calculateTrip} reset={reset} isLoading={isPending} errorText={customError} />
        </aside>

        <section className="lg:col-span-3 space-y-6">
          {!isPending && data && (
            <div>
              <RouteAndSummary coordinates={data.coordinates} directions={data.directions} current_coords={data.current_coords} />
            </div>
          )}

          {!isPending && !data && (
            <div className="p-8 text-center border-4 border-dashed border-indigo-800 rounded-xl h-96 flex flex-col items-center justify-center">
              <MapPin className="w-12 h-12 text-indigo-600 mb-4" />
              <h2 className="text-2xl font-semibold text-indigo-400">Ready to Plan Your Trip</h2>
              <p className="text-gray-400 mt-2 max-w-lg">Enter trip details and click 'Generate Route & Logs' to see the optimal route, rest stops, and daily ELD sheets. UI improved for readability and quick scanning — logic unchanged.</p>
            </div>
          )}

          {isPending && (
            <div className="p-8 text-center border-4 border-dashed border-indigo-800 rounded-xl h-96 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
              <h2 className="text-2xl font-semibold text-indigo-400">Calculating...</h2>
              <p className="text-gray-400 mt-2 max-w-lg">The backend will determine the route, mandatory rest breaks, fueling stops and generate multi-day, compliant ELD logs.</p>
            </div>
          )}
        </section>
      </main>

      <footer className="mt-12 text-center text-gray-500 text-sm pt-4 border-t border-gray-800">
        &copy; 2024 HOS Compliance App — UI Redesign (visual only). Logic and behavior preserved.
      </footer>
    </div>
  );
};

export default App;
