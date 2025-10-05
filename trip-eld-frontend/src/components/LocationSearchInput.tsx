import React, { useState, useEffect, useRef } from "react";
import { Search, X, MapPin } from "lucide-react";
import type { GeoJSON, Point, Position } from "geojson";
import { useQuery } from "@tanstack/react-query";
import { API_KEY } from "../lib/constants";

interface LocationSearchInputProps {
  inputValue: string;
  setInputValue: (val: string) => void;
  value: Position | null,
  name: string;
  label: string;
  onLocationSelect: (feature: GeoJSON.Feature<Point, GeoJSON.GeoJsonProperties> | null) => void;
  placeholder?: string;
}

function useDebounceValue<T>(value: T, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debouncedValue;
}

type SearchResults = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  GeoJSON.GeoJsonProperties & { label?: string; id?: string | number }
>;

export function LocationSearchInput({
  onLocationSelect,
  placeholder = "Search for a location...",
  name,
  label,
  inputValue,
  setInputValue,
  value: selectedLocation
}: LocationSearchInputProps) {
  const debouncedInputValue = useDebounceValue(inputValue, 400);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [suppressAfterSelect, setSuppressAfterSelect] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data: results, isLoading } = useQuery({
    queryKey: ["search", debouncedInputValue],
    queryFn: async ({ signal }) => {
      const qs = new URLSearchParams({ api_key: API_KEY, text: debouncedInputValue });
      const res = await fetch(`https://api.openrouteservice.org/geocode/autocomplete?${qs.toString()}`, { signal });
      if (!res.ok) {
        try { console.error(await res.json()); } catch (e) { console.error(e); }
        return null;
      }
      return (await res.json()) as SearchResults;
    },
    enabled: debouncedInputValue.length >= 2,
    staleTime: 1000 * 60 * 2,
  });

  useEffect(() => {
    if (results && results.features && results.features.length > 0) {
      if (suppressAfterSelect) return;
      setIsDropdownOpen(true);
      setHighlightIndex(-1);
    } else {
      if (suppressAfterSelect) return;
      setIsDropdownOpen(debouncedInputValue.length >= 2);
      setHighlightIndex(-1);
    }
  }, [results, debouncedInputValue]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (selectedLocation) {
      onLocationSelect(null);
      onLocationSelect(null);
    }
    setSuppressAfterSelect(false);
  };

  const chooseFeature = (feature: GeoJSON.Feature<Point, GeoJSON.GeoJsonProperties & { label?: string; id?: string | number }>) => {
    const label =
      (feature.properties && (feature.properties.label as string)) ||
      (feature.properties && (feature.properties.name as string)) ||
      "Selected place";
    setInputValue(label);
    onLocationSelect(feature);
    setIsDropdownOpen(false);
    setSuppressAfterSelect(true);
    setHighlightIndex(-1);
    onLocationSelect(feature);
  };

  const clear = () => {
    setInputValue("");
    onLocationSelect(null);
    onLocationSelect(null);
    setIsDropdownOpen(false);
    setSuppressAfterSelect(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen) {
      if (e.key === "ArrowDown" && (results?.features?.length ?? 0) > 0) {
        setIsDropdownOpen(true);
        setHighlightIndex(0);
      }
      return;
    }
    const count = results?.features?.length ?? 0;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex(i => Math.min(i + 1, count - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && results?.features?.[highlightIndex]) {
        chooseFeature(results.features[highlightIndex] as any);
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
  };

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      <div className="w-full max-w-md mx-auto" ref={wrapperRef}>
        <div className="relative">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
              <Search className="h-5 w-5 text-gray-400" />
            </div>

            <input
              ref={inputRef}
              type="text"
              required={true}
              placeholder={placeholder}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={onKeyDown}
              aria-expanded={isDropdownOpen}
              aria-haspopup="listbox"
              className="block w-full rounded-lg border-0 py-2 pl-10 pr-10 bg-gray-900 text-white placeholder-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm transition duration-150"
            />

            <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
              {isLoading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : inputValue ? (
                <button
                  type="button"
                  onClick={clear}
                  aria-label="Clear"
                  className="btn btn-ghost btn-circle btn-xs"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {isDropdownOpen && (
            <div className="absolute left-0 right-0 z-30 mt-2 bg-gray-900 rounded-lg shadow-lg border border-gray-800 overflow-hidden">
              <ul role="listbox" aria-label="Location results" className="max-h-60 overflow-y-auto">
                {isLoading ? (
                  <li className="p-4">
                    <div className="space-y-2">
                      <div className="h-3 rounded bg-gray-800 animate-pulse w-3/4" />
                      <div className="h-3 rounded bg-gray-800 animate-pulse w-1/2" />
                    </div>
                  </li>
                ) : results && results.features && results.features.length > 0 ? (
                  results.features.map((feature, idx) => {
                    const id = feature.properties?.id ?? feature.properties?.label ?? `${idx}`;
                    const label =
                      (feature.properties && (feature.properties.label as string)) ||
                      (feature.properties && (feature.properties.name as string)) ||
                      "Unnamed place";
                    const coords =
                      feature.geometry?.type === "Point"
                        ? (feature.geometry as GeoJSON.Point).coordinates
                        : null;
                    const subtitle = coords ? `${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}` : undefined;
                    const isHighlighted = idx === highlightIndex;

                    return (
                      <li
                        key={String(id)}
                        role="option"
                        aria-selected={isHighlighted}
                        onMouseEnter={() => setHighlightIndex(idx)}
                        onMouseLeave={() => setHighlightIndex(-1)}
                        onClick={() => chooseFeature(feature as any)}
                        className={`px-3 py-2 cursor-pointer flex items-start gap-3 transition-colors ${isHighlighted ? "bg-gray-800" : "hover:bg-gray-800"
                          }`}
                      >
                        <div className="mt-0.5">
                          <MapPin className="h-5 w-5 text-gray-300" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm text-white truncate">{label}</div>
                          {subtitle && <div className="text-xs text-gray-400 truncate">{subtitle}</div>}
                        </div>
                      </li>
                    );
                  })
                ) : (
                  <li className="px-4 py-6 text-center text-sm text-gray-400">No results found</li>
                )}
              </ul>

              <div className="px-3 py-2 border-t border-gray-800 text-xs text-gray-400 flex items-center justify-between">
                <div>Use ↑/↓ + Enter</div>
                <button className="btn btn-ghost btn-xs" onClick={() => setIsDropdownOpen(false)}>Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
