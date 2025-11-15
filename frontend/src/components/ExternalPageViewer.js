import React, { useState } from 'react';
import ConnectionForm from './ConnectionForm';
import IframeViewer from './IframeViewer';
import RightSidePanel from './RightSidePanel';
import './ExternalPageViewer.css';

/**
 * Główny komponent łączący formularz i wyświetlacz zewnętrznej strony
 * 
 * @param {Object} props - Właściwości komponentu
 * @param {string} props.initialUrl - Początkowy adres URL do połączenia
 */
const ExternalPageViewer = ({ initialUrl = '' }) => {
  const [formattedUrl, setFormattedUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  
  // Definicja kolorów używanych w aplikacji
  const colors = {
    background: '#1e293b',     // Ciemne tło
    surface: '#2d3748',        // Powierzchnie komponentów
    primary: '#3182ce',        // Główny kolor akcentujący (niebieski)
    success: '#38a169',        // Zielony dla sukcesu
    error: '#e53e3e',          // Czerwony dla błędów
    warning: '#ed8936',        // Pomarańczowy dla ostrzeżeń
    text: {
      primary: '#ffffff',      // Biały tekst podstawowy
      secondary: '#a0aec0',    // Szary tekst drugorzędny
    }
  };
  
  /**
   * Obsługa próby połączenia
   * @param {string} url - Adres URL do połączenia
   */
  const handleConnect = (url) => {
    setFormattedUrl(url);
    setIsConnecting(true);
    setIframeError(false);
    
    // Symulacja łączenia (można zastąpić faktycznym ładowaniem)
    setTimeout(() => {
      setIsConnected(true);
    }, 2000);
  };
  
  /**
   * Obsługa błędu ładowania iframe
   */
  const handleIframeError = () => {
    setIframeError(true);
    setIsConnected(false);
    setIsConnecting(false);
  };
  
  /**
   * Obsługa ponownej próby połączenia po błędzie
   */
  const handleRetry = () => {
    setIframeError(false);
    setIsConnecting(true);
    setIsConnected(false);
    
    // Druga próba z alternatywnym protokołem
    const newUrl = formattedUrl.startsWith('https://') 
      ? formattedUrl.replace('https://', 'http://') 
      : formattedUrl.replace('http://', 'https://');
    
    setFormattedUrl(newUrl);
    
    // Ponowna symulacja łączenia
    setTimeout(() => {
      setIsConnected(true);
    }, 2000);
  };
  
  /**
   * Określenie, czy warstwa ładowania powinna być widoczna
   */
  const isLoadingVisible = isConnecting && !isConnected;
  
  return (
    <div className="external-page-viewer">
      {/* Warstwa wyświetlająca stronę */}
      <IframeViewer 
        url={formattedUrl}
        visible={isConnected && !iframeError}
        onError={handleIframeError}
      />
      
      {/* Panel boczny z ciemną kolorystyką */}
      {/* <RightSidePanel
        initialOpacity={0.9}
        backgroundColor={colors.surface}
        width='250px'
        zIndex={999}
        style={{
          boxShadow: '-2px 0 10px rgba(0, 0, 0, 0.3)',
          borderLeft: `1px solid ${colors.background}`
        }}
      /> */}
      
      {/* Warstwa ładowania */}
      <div className={`loading-overlay ${isLoadingVisible ? 'visible' : ''}`}>
        <div className="spinner"></div>
        <p className="loading-text">Łączenie z {formattedUrl}...</p>
      </div>
      
      {/* Warstwa formularza */}
      <ConnectionForm 
        initialUrl={initialUrl}
        onConnect={handleConnect}
        connecting={isConnecting}
        connected={isConnected}
        connectionError={iframeError}
        onRetry={handleRetry}
        /* Przekazanie stylów do komponentu formularza */
        styles={{
          container: {
            backgroundColor: colors.surface,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            borderRadius: '8px',
            color: colors.text.primary
          },
          input: {
            backgroundColor: colors.background,
            color: colors.text.primary,
            borderColor: colors.primary
          },
          button: {
            backgroundColor: colors.primary,
            color: colors.text.primary
          },
          errorContainer: {
            backgroundColor: colors.error,
            color: 'white'
          }
        }}
      />
    </div>
  );
};

export default ExternalPageViewer;