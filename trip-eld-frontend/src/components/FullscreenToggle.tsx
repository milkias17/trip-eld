import React from 'react';
import useFullscreen from '../hooks/useFullscreen';
import './FullscreenToggle.css';

function FullscreenToggle() {
  const { elementRef, isFullscreen, toggleFullscreen } = useFullscreen();

  return (
    <div
      className={`fullscreen-container ${isFullscreen ? 'is-fullscreen' : ''}`}
      ref={elementRef}
    >
      <h2>Element to Toggle Fullscreen (TypeScript)</h2>
      <p>Click the button to make this entire box fill the screen.</p>
      <p>Press <kbd>Esc</kbd> to exit fullscreen or click the button again.</p>

      <button onClick={toggleFullscreen}>
        {isFullscreen ? 'Exit Fullscreen' : 'Go Fullscreen'}
      </button>

      <small>Status: {isFullscreen ? 'FULLSCREEN' : 'Windowed'}</small>
    </div>
  );
}

export default FullscreenToggle;
