import React from 'react';
import './ConnectionStatus.css';

/**
 * Komponent wyświetlający aktualny stan połączenia
 * @param {Object} props - Właściwości komponentu
 * @param {boolean} props.connecting - Czy trwa łączenie
 * @param {boolean} props.connected - Czy połączenie zostało nawiązane
 * @param {boolean} props.connectionError - Czy wystąpił błąd połączenia
 * @param {boolean} props.isPinging - Czy trwa sprawdzanie dostępności adresu
 * @param {string|null} props.pingStatus - Status pingu ('success', 'error' lub null)
 * @param {string|null} props.pingTime - Czas pingu w ms (jako string)
 * @param {string|null} props.pingMethod - Metoda użyta do sprawdzenia dostępności
 * @param {boolean} props.devMode - Czy tryb deweloperski jest włączony
 * @param {Function} props.onForceConnect - Funkcja wywoływana przy wymuszeniu połączenia
 * @param {Object} props.styles - Opcjonalne style niestandardowe
 */
const ConnectionStatus = ({ 
  connecting = false, 
  connected = false, 
  connectionError = false, 
  isPinging = false,
  pingStatus = null,
  pingTime = null,
  pingMethod = null,
  devMode = false,
  onForceConnect = () => {},
  styles = {}
}) => {
  // Debugowanie stanu wskaźników
  console.log("ConnectionStatus state:", { 
    connecting, connected, connectionError, isPinging, 
    pingStatus, pingTime, pingMethod, devMode 
  });
  
  // Określenie stanu połączenia
  const isConnected = connected && !connectionError;
  const isConnecting = connecting && !connected && !connectionError;
  const isPingError = pingStatus === 'error' && !connecting && !connected;
  const isPingSuccess = pingStatus === 'success' && !connecting && !connected;
  
  // Obsługa kliknięcia "Połącz mimo to"
  const handleForceConnect = () => {
    onForceConnect();
  };

  // Określenie stylów niestandardowych
  const customStyles = {
    container: styles.loadingIndicator || {}
  };

  // Formatowanie informacji o pingu
  const renderPingInfo = () => {
    if (!pingTime) return null;
    
    // Określenie stylu kolorystycznego dla czasu pingu
    let pingTimeStyle = {};
    const pingTimeValue = parseFloat(pingTime);
    
    if (!isNaN(pingTimeValue)) {
      if (pingTimeValue < 30) {
        pingTimeStyle.color = '#4CAF50'; // zielony - dobry ping
      } else if (pingTimeValue < 100) {
        pingTimeStyle.color = '#FFC107'; // żółty - średni ping
      } else {
        pingTimeStyle.color = '#f44336'; // czerwony - słaby ping
      }
    }
    
    return (
      <span className="connection-status-ping-info">
        Ping: <span style={pingTimeStyle}>{pingTime}</span>
        {pingMethod && <span className="connection-status-ping-method"> ({pingMethod})</span>}
      </span>
    );
  };

  return (
    <div className="connection-status" style={customStyles.container}>
      {/* Stan "połączono" */}
      <div className={`connection-status-spinner-container ${isConnected ? 'visible' : 'hidden'}`}>
        <div className="connection-status-success-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>
      
      {/* Stan "łączenie" */}
      <div className={`connection-status-spinner-container ${isConnecting ? 'visible' : 'hidden'}`}>
        <div className="connection-status-connecting-icon">
          <div className="connection-status-spinner connection-status-spinner-blue"></div>
        </div>
      </div>
      
      {/* Stan "sprawdzanie" (ping) */}
      <div className={`connection-status-spinner-container ${isPinging ? 'visible' : 'hidden'}`}>
        <div className="connection-status-pinging-icon">
          <div className="connection-status-spinner connection-status-spinner-yellow"></div>
        </div>
      </div>
      
      {/* Teksty statusu */}
      <div className="connection-status-text-container">
        <p className={`connection-status-text success ${isConnected ? 'visible' : 'hidden'}`}>
          Połączono pomyślnie!
          {renderPingInfo()}
        </p>
        <p className={`connection-status-text ${isConnecting ? 'visible' : 'hidden'}`}>
          Nawiązywanie połączenia...
        </p>
        <p className={`connection-status-text ${isPinging ? 'visible' : 'hidden'}`}>
          Sprawdzanie dostępności adresu...
        </p>
        <p className={`connection-status-text success ${isPingSuccess ? 'visible' : 'hidden'}`}>
          Adres dostępny! {renderPingInfo()}
        </p>
        <p className={`connection-status-text error ${isPingError ? 'visible' : 'hidden'}`}>
          Adres nie jest dostępny. 
          <span 
            onClick={handleForceConnect} 
            className="connection-status-force-connect"
          >
            Połącz mimo to
          </span>
        </p>
        {devMode && (
          <p className={`connection-status-text warning visible`} style={{color: '#FFC107', marginTop: '4px', marginLeft: '200px'}}>
            Tryb deweloperski aktywny
          </p>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;