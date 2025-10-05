import { useEffect } from 'react';
import { useMapEvents } from 'react-leaflet';

export const FullscreenHandler: React.FC<{ isFullscreen: boolean }> = ({ isFullscreen }) => {
  const map = useMapEvents({});

  useEffect(() => {
    map.invalidateSize();
  }, [isFullscreen, map]);

  return null;
};
