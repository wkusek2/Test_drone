import React from 'react';
import './IframeViewer.css';

/**
 * Komponent odpowiedzialny tylko za wyświetlanie strony w iframe
 * z obrotem o 180 stopni
 * 
 * @param {string} url - URL strony do wyświetlenia w iframe
 * @param {boolean} visible - Czy iframe ma być widoczny
 * @param {Function} onError - Funkcja obsługująca błędy ładowania iframe
 * @returns {JSX.Element|null} - Element iframe lub null gdy URL jest pusty
 */
const IframeViewer = ({ 
  url = '', 
  visible = false, 
  onError = () => {} 
}) => {
  // Jeśli brak URL, nie renderuj iframe
  if (!url) return null;
  
  // Styl z obrotem o 180 stopni
  const rotationStyle = {
    transform: 'rotate(180deg)',
    transformOrigin: 'center center',
    width: '100%',
    height: '100%'
  };
  
  return (
    <div style={rotationStyle} className={`iframe-container ${visible ? 'visible' : 'hidden'}`}>
      <iframe
        src={url}
        className="iframe-viewer"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        referrerPolicy="no-referrer"
        allow="fullscreen"
        onError={onError}
        title="External content viewer"
      />
    </div>
  );
};

export default IframeViewer;