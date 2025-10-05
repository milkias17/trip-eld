import { useRef, useCallback, useState, useEffect, type RefObject } from 'react';

export interface FullscreenHook {
  elementRef: RefObject<HTMLElement>;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

interface FullscreenMethods {
  request: ((options?: FullscreenOptions) => Promise<void>) | undefined;
  exit: (() => Promise<void>) | undefined;
  element: Element | null;
}

const getFullscreenMethods = (element: HTMLElement | Document): FullscreenMethods => {
  const isDocument = element === document;

  const doc = document as any;
  const elem = element as any;

  return {
    request: isDocument ? undefined : (elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen || elem.msRequestFullscreen),
    exit: doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen,
    element: doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement,
  };
};

const useFullscreen = (): FullscreenHook => {
  const elementRef = useRef<HTMLElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const toggleFullscreen = useCallback(() => {
    const element = elementRef.current;
    if (!element) return;

    const { exit, element: fullscreenElement } = getFullscreenMethods(document);

    if (fullscreenElement) {
      exit?.call(document).catch((err: Error) => {
        console.error("Error exiting fullscreen:", err);
      });
    } else {
      const { request: requestElement } = getFullscreenMethods(element);

      requestElement?.call(element).catch((err: Error) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const { element: currentFullscreenElement } = getFullscreenMethods(document);
      setIsFullscreen(currentFullscreenElement === elementRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  return { elementRef, isFullscreen, toggleFullscreen };
};

export default useFullscreen;
