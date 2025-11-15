import React from 'react';
import './DevModeCheckbox.css';

/**
 * Komponent wyświetlający checkbox do przełączania trybu deweloperskiego
 * 
 * @param {Object} props - Właściwości komponentu
 * @param {boolean} props.devMode - Czy tryb deweloperski jest włączony
 * @param {Function} props.onToggle - Funkcja wywoływana przy zmianie stanu checkboxa
 * @param {Object} props.style - Opcjonalne style niestandardowe
 * @returns {JSX.Element} - Komponent React
 */
const DevModeCheckbox = ({ devMode, onToggle, style = {} }) => {
  return (
    <div 
      className="dev-mode-container"
      style={style}
      onClick={() => onToggle(!devMode)}
    >
      <input 
        type="checkbox" 
        id="dev-mode-checkbox"
        checked={devMode}
        onChange={(e) => onToggle(e.target.checked)}
        className="dev-mode-checkbox"
      />
      <label htmlFor="dev-mode-checkbox" className="dev-mode-label">Tryb dev</label>
    </div>
  );
};

export default DevModeCheckbox;