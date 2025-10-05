import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import useFullscreen, { type FullscreenHook } from '../hooks/useFullscreen';


const FullscreenHandler: React.FC<{ isFullscreen: boolean }> = ({ isFullscreen }) => {
  const map = useMapEvents({});

  useEffect(() => {
    map.invalidateSize();
  }, [isFullscreen, map]);

  return null;
};

const MapFullscreen: React.FC = () => {
  const { elementRef, isFullscreen, toggleFullscreen }: FullscreenHook = useFullscreen();

  return (
    <div
      ref={elementRef as React.RefObject<HTMLDivElement>}
      className={`map-container ${isFullscreen ? 'is-fullscreen' : ''}`}
    >
      <MapContainer
        center={[51.505, -0.09]}
        zoom={13}
        scrollWheelZoom={false}
        className="map-element"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[51.505, -0.09]}>
          <Popup>A simple Leaflet Map.</Popup>
        </Marker>

        <FullscreenHandler isFullscreen={isFullscreen} />

      </MapContainer>

      <button
        onClick={toggleFullscreen}
        style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}
      >
        {isFullscreen ? 'Exit Fullscreen' : 'Toggle Fullscreen'}
      </button>

    </div>
  );
};

export default MapFullscreen;
