import { Truck, MapPin, Clock, Loader2, ListOrdered } from "lucide-react";
import { Card, InputGroup, ProgressBar } from "./ui-helpers";
import type { Inputs } from "../lib/types";
import { useState, type ChangeEvent } from "react";
import { LocationSearchInput } from "./LocationSearchInput";
import type { LatLngTuple } from "leaflet";
import type { Feature, GeoJsonProperties, Point, Position } from "geojson";

type Props = {
  inputs: Inputs;
  handleChange: (name: "currentLocation" | "dropoffLocation" | "pickupLocation", coordinates: Position | null | undefined) => void;
  calculateTrip: () => void;
  reset: () => void;
  isLoading: boolean;
  errorText: string;
}

export const TripInputForm: React.FC<Props> = ({ errorText, inputs, handleChange, calculateTrip, isLoading, reset }) => {

  const [inputValues, setInputValues] = useState({
    currentLocation: "",
    pickupLocation: "",
    dropoffLocation: ""
  })

  function getLocationSelect(name: "currentLocation" | "dropoffLocation" | "pickupLocation") {
    return (s: Feature<Point, GeoJsonProperties> | null) => handleChange(name, s?.geometry.coordinates)
  }

  return (
    <Card title="Trip Planner Inputs" icon={Truck}>
      {errorText !== "" && <p className="text-red-400 mb-4">{errorText}</p>}
      <div className="space-y-4">
        <LocationSearchInput inputValue={inputValues.currentLocation} setInputValue={(val) => setInputValues((prev) => ({ ...prev, currentLocation: val }))} value={inputs.currentLocation} onLocationSelect={getLocationSelect("currentLocation")} name="currentLocation" label="Current Location (Start)" placeholder="e.g., Los Angeles, CA" />

        <LocationSearchInput inputValue={inputValues.pickupLocation} setInputValue={(val) => setInputValues((prev) => ({ ...prev, pickupLocation: val }))} value={inputs.pickupLocation} onLocationSelect={getLocationSelect("pickupLocation")} name="pickupLocation" label="Pickup Location" placeholder="e.g., Philadelphia, PA" />

        <LocationSearchInput
          inputValue={inputValues.dropoffLocation}
          setInputValue={(val) => setInputValues((prev) => ({ ...prev, dropoffLocation: val }))}
          value={inputs.dropoffLocation}
          onLocationSelect={getLocationSelect("dropoffLocation")}
          name="dropoffLocation" label="Dropoff Location" placeholder="e.g., Denver, CO" />


        <InputGroup
          label="Current 70hr/8day Cycle Used (Hrs)"
          name="cycleUsedHours"
          type="number"
          min={0}
          max={70}
          value={inputs.cycleUsedHours}
          onChange={(e) => handleChange("cycleUsedHours", e.target.value)}
          placeholder="e.g., 15"
          icon={Clock}
        />

        <div className="flex gap-3">
          <button
            onClick={calculateTrip}
            disabled={isLoading}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 transition"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Calculating
              </>
            ) : (
              <>
                <ListOrdered className="w-4 h-4 mr-2" />
                Generate Route & Logs
              </>
            )}
          </button>

          <button
            onClick={() => {
              setInputValues({
                currentLocation: "",
                pickupLocation: "",
                dropoffLocation: ""
              })
              reset()
            }}
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-700 text-sm font-medium rounded-lg text-gray-200 bg-gray-800 hover:bg-gray-700 transition"
            title="Reset results"
          >
            Reset
          </button>
        </div>

        <div className="pt-2">
          <ProgressBar label="70-hour cycle used" value={inputs.cycleUsedHours} max={70} />
        </div>

        <div className="text-xs text-gray-500 mt-2">Tip: You may enter city names or lat,long pairs. This UI is focused on readability — the logic remains unchanged.</div>
      </div>
    </Card>
  )
};

