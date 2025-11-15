import React, { useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketManager';
import './SystemMonitor.css';

const SystemMonitor = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Użyj kontekstu WebSocket
  const { connected: wsConnected, systemStats } = useWebSocket();

  // Fallback na HTTP jeśli WebSocket nie działa
  useEffect(() => {
    const fetchSystemStats = async () => {
      try {
        const response = await fetch('http://192.168.137.2:8000/api/system-stats');
        
        if (!response.ok) {
          throw new Error(`Błąd HTTP: ${response.status}`);
        }
        
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
        console.error('Błąd pobierania danych:', err);
      }
    };
    
    // Wywołaj HTTP API tylko gdy WebSocket nie działa
    if (!wsConnected) {
      fetchSystemStats();
    } else {
      setLoading(false);
    }
  }, [wsConnected]);

  // Określanie kolorów wskaźników na podstawie wartości
  const getCpuUsageColor = (usage) => {
    if (usage < 50) return 'green';
    if (usage < 80) return 'orange';
    return 'red';
  };

  const getTemperatureColor = (temp) => {
    if (temp < 60) return 'green';
    if (temp < 75) return 'orange';
    return 'red';
  };

  // Formatowanie czasu ostatniej aktualizacji
  const getLastUpdateTime = () => {
    if (!systemStats.timestamp) return 'Nieznany';
    
    const date = new Date(systemStats.timestamp * 1000);
    return date.toLocaleTimeString();
  };

  if (error) {
    return (
      <div className="system-monitor-container">
        <div className="system-monitor-header error">
          <h2 className="system-monitor-title">Błąd</h2>
        </div>
        <p>Nie udało się pobrać danych: {error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="system-monitor-retry-button"
        >
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  return (
    <div className="system-monitor-container">
      <div className="system-monitor-header">
        <h2 className="system-monitor-title">Monitor Systemu</h2>
        <div 
          className={`system-monitor-status-indicator ${loading ? 'loading' : 'connected'}`} 
          title={loading ? "Ładowanie..." : wsConnected ? "Połączony (WebSocket)" : "Połączony (HTTP)"} 
        />
      </div>

      {/* CPU Usage */}
      <div className="system-monitor-stat-item">
        <div className="system-monitor-stat-header">
          <span className="system-monitor-stat-label">Obciążenie CPU</span>
          <span 
            className="system-monitor-stat-value"
            style={{ color: getCpuUsageColor(systemStats.cpu_usage) }}
          >
            {systemStats.cpu_usage.toFixed(1)}%
          </span>
        </div>
        <div className="system-monitor-progress-bar-container">
          <div 
            className="system-monitor-progress-bar"
            style={{
              width: `${systemStats.cpu_usage}%`, 
              backgroundColor: getCpuUsageColor(systemStats.cpu_usage)
            }} 
          />
        </div>
      </div>

      {/* Temperature */}
      <div className="system-monitor-stat-item">
        <div className="system-monitor-stat-header">
          <span className="system-monitor-stat-label">Temperatura</span>
          <span 
            className="system-monitor-stat-value"
            style={{ color: getTemperatureColor(systemStats.temperature) }}
          >
            {systemStats.temperature.toFixed(1)}°C
          </span>
        </div>
        <div className="system-monitor-progress-bar-container">
          <div 
            className="system-monitor-progress-bar"
            style={{
              width: `${(systemStats.temperature / 100) * 100}%`, 
              backgroundColor: getTemperatureColor(systemStats.temperature)
            }} 
          />
        </div>
      </div>

      <div className="system-monitor-time">
        Ostatnia aktualizacja: {getLastUpdateTime()}
        {wsConnected && <span className="system-monitor-connection-type"> (na żywo)</span>}
      </div>
    </div>
  );
};

export default SystemMonitor;