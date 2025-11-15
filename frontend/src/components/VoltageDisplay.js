import React from 'react';
import { useWebSocket } from './WebSocketManager';

const VoltageDisplay = () => {
  const { voltageData } = useWebSocket();
  
  // Funkcja do określania koloru na podstawie wartości napięcia
  const getVoltageColor = (voltage) => {
    if (voltage >= 11.5) return '#4CAF50'; // Zielony dla dobrego napięcia
    if (voltage >= 10.5) return '#FFC107'; // Żółty dla średniego napięcia
    return '#F44336'; // Czerwony dla niskiego napięcia
  };
  
  // Funkcja do określania stanu baterii na podstawie napięcia
  const getBatteryStatus = (voltage) => {
    if (voltage >= 12.0) return 'Pełna';
    if (voltage >= 11.5) return 'Dobra';
    if (voltage >= 11.0) return 'Średnia';
    if (voltage >= 10.5) return 'Niska';
    return 'Krytycznie niska';
  };
  
  // Funkcja do obliczania przybliżonego poziomu naładowania w procentach
  const getBatteryPercentage = (voltage) => {
    // Zakładamy, że 12.6V to 100%, a 10.5V to 0%
    const maxVoltage = 12.6;
    const minVoltage = 10.5;
    const range = maxVoltage - minVoltage;
    
    // Obliczamy procent
    let percentage = Math.round(((voltage - minVoltage) / range) * 100);
    
    // Ograniczamy do zakresu 0-100%
    percentage = Math.max(0, Math.min(100, percentage));
    
    return percentage;
  };
  
  // Formatowanie czasu ostatniej aktualizacji
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Nieznany';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString();
  };
  
  // Styl dla kontenera
  const containerStyle = {
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    padding: '12px',
    margin: '8px 0',
    color: 'white',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    maxWidth: '100%',
  };
  
  // Styl dla nagłówka
  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  };
  
  // Styl dla tytułu
  const titleStyle = {
    fontSize: '16px',
    fontWeight: 'bold',
    margin: '0'
  };
  
  // Styl dla wskaźnika statusu
  const statusIndicatorStyle = {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: getVoltageColor(voltageData.voltage)
  };
  
  // Styl dla wartości napięcia
  const voltageValueStyle = {
    fontSize: '28px',
    fontWeight: 'bold',
    color: getVoltageColor(voltageData.voltage),
    marginBottom: '8px',
    textAlign: 'center'
  };
  
  // Styl dla statusu baterii
  const batteryStatusStyle = {
    fontSize: '16px',
    fontWeight: 'normal',
    textAlign: 'center',
    marginBottom: '12px'
  };
  
  // Styl dla kontenera paska postępu
  const progressBarContainerStyle = {
    backgroundColor: '#2d3748',
    height: '20px',
    borderRadius: '10px',
    overflow: 'hidden',
    marginBottom: '12px'
  };
  
  // Styl dla paska postępu
  const progressBarStyle = {
    height: '100%',
    backgroundColor: getVoltageColor(voltageData.voltage),
    width: `${getBatteryPercentage(voltageData.voltage)}%`,
    transition: 'width 0.5s ease-in-out'
  };
  
  // Styl dla czasu aktualizacji
  const timestampStyle = {
    fontSize: '12px',
    color: '#a0aec0',
    textAlign: 'right'
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>Napięcie baterii</h3>
        <div style={statusIndicatorStyle}></div>
      </div>
      
      <div style={voltageValueStyle}>
        {voltageData.voltage.toFixed(2)} V
      </div>
      
      <div style={batteryStatusStyle}>
        Stan: {getBatteryStatus(voltageData.voltage)} ({getBatteryPercentage(voltageData.voltage)}%)
      </div>
      
      <div style={progressBarContainerStyle}>
        <div style={progressBarStyle}></div>
      </div>
      
      <div style={timestampStyle}>
        Ostatnia aktualizacja: {formatTimestamp(voltageData.timestamp)}
      </div>
    </div>
  );
};

export default VoltageDisplay;