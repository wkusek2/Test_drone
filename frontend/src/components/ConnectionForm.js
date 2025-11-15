import React, { useState, useEffect, useCallback } from 'react';
import BackgroundEffects from './BackgroundEffects';
import ConnectionStatus from './ConnectionStatus';
import DevModeCheckbox from './DevModeCheckbox';
import Logo from './Logo';
import ConnectionError from './ConnectionError';
import IPForm from './IPForm';
import './ConnectionForm.css';

/**
 * Komponent główny odpowiedzialny za formularz wprowadzania IP i efekty tła
 * 
 * @param {Object} props - Właściwości komponentu
 * @param {string} props.initialUrl - Początkowy adres URL
 * @param {Function} props.onConnect - Funkcja wywoływana po nawiązaniu połączenia
 * @param {boolean} props.connecting - Czy trwa proces łączenia
 * @param {boolean} props.connected - Czy połączenie zostało nawiązane
 * @param {boolean} props.connectionError - Czy wystąpił błąd połączenia
 * @param {Function} props.onRetry - Funkcja wywoływana przy ponownej próbie połączenia
 * @param {Object} props.styles - Niestandardowe style
 * @param {string} props.pingApiUrl - URL do API sprawdzania dostępności hostów
 */
const ConnectionForm = ({ 
  initialUrl = '', 
  onConnect = () => {}, 
  connecting = false, 
  connected = false, 
  connectionError = false,
  onRetry = () => {},
  styles = {}, 
  pingApiUrl = 'http://localhost:8000/api/ping'
}) => {
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [backgroundOpacity, setBackgroundOpacity] = useState(1);
  const [isPinging, setIsPinging] = useState(false);
  const [pingStatus, setPingStatus] = useState(null); // null, 'success' lub 'error'
  const [devMode, setDevMode] = useState(false); // Stan dla trybu deweloperskiego
  const [pingTime, setPingTime] = useState(null); // Czas pingu w ms
  const [pingMethod, setPingMethod] = useState(null); // Metoda użyta do pingowania

  /**
   * Walidacja adresu IP, domeny lub adresu z portem
   * @param {string} input - Adres do walidacji
   * @returns {boolean} - Czy adres jest poprawny
   */
  const isValidIpAddress = (input) => {
    if (!input || input.trim() === '') return false;
    
    // Sprawdza standardowy adres IP
    const ipRegex = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?(\/.*)?$/;
    
    // Sprawdza domenę (bardziej ogólne podejście)
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/;
    
    // Sprawdza czy to jest raspberry.pi (z opcjonalnym portem i ścieżką)
    const raspberryPiRegex = /^raspberry\.pi(:\d+)?(\/.*)?$/;
    
    // Sprawdza lokalną nazwę hosta (np. roboczy, localhost)
    const localhostRegex = /^[a-zA-Z][a-zA-Z0-9\-]*(:\d+)?(\/.*)?$/;
    
    return ipRegex.test(input) || domainRegex.test(input) || raspberryPiRegex.test(input) || localhostRegex.test(input);
  };

  /**
   * Funkcja do wymuszenia połączenia mimo nieudanego pingu
   */
  const forceConnect = useCallback(() => {
    console.log("Wymuszenie połączenia mimo nieudanego pingu z adresem:", inputUrl);
    
    // Przygotowanie URL
    let url = inputUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    
    // Resetowanie stanu błędu pingu
    setPingStatus(null);
    
    // Wywołanie funkcji połączenia
    onConnect(url);
  }, [inputUrl, onConnect]);

  /**
   * Obsługa nawiązywania połączenia
   */
  const handleConnect = async () => {
    console.log("handleConnect called with URL:", inputUrl);
    
    if (!isValidIpAddress(inputUrl)) {
      console.log("Invalid IP address");
      return;
    }
    
    // Przygotowanie URL
    let url = inputUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    
    // Jeśli tryb deweloperski jest włączony, pomiń sprawdzanie dostępności
    if (devMode) {
      console.log("Dev mode enabled - skipping connectivity check");
      setPingStatus('success');
      setPingTime('N/A (Dev mode)');
      setPingMethod('dev_mode');
      onConnect(url);
      return;
    }
    
    try {
      console.log("Starting connectivity check using backend API");
      setIsPinging(true);
      setPingStatus(null);
      setPingTime(null);
      setPingMethod(null);
      
      // Usuwamy http:// lub https:// aby uzyskać czysty adres
      let hostToCheck = url;
      if (hostToCheck.startsWith('http://')) {
        hostToCheck = hostToCheck.substring(7);
      } else if (hostToCheck.startsWith('https://')) {
        hostToCheck = hostToCheck.substring(8);
      }
      
      // Wyciągamy tylko adres podstawowy (bez portu i ścieżki)
      const hostOnly = hostToCheck.split('/')[0].split(':')[0];
      
      console.log(`Sprawdzanie połączenia z adresem: ${hostOnly}`);
      console.log(`Używany URL API: ${pingApiUrl}`);
      
      try {
        const response = await fetch(pingApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            host: hostOnly,
            timeout: 3 // 3 sekundy timeout
          }),
        });
        
        if (!response.ok) {
          console.error(`Błąd serwera: ${response.status} - ${response.statusText}`);
          setPingStatus('error');
          setIsPinging(false);
          return;
        }
        
        const data = await response.json();
        console.log("Odpowiedź z API:", data);
        
        if (data.success) {
          console.log(`Sprawdzenie udane, metoda: ${data.method || 'nieznana'}, czas: ${data.time_ms}ms`);
          
          // Zapisz dane pingu
          setPingTime(`${data.time_ms}ms`);
          setPingMethod(data.method || 'unknown');
          
          // Sprawdź czy jest ostrzeżenie, jeśli tak - wyświetl je, ale kontynuuj
          if (data.warning) {
            console.warn(`Ostrzeżenie: ${data.warning}`);
          }
          
          setPingStatus('success');
          setIsPinging(false);
          
          // Wykonaj akcję połączenia
          console.log("Calling onConnect with URL:", url);
          onConnect(url);
        } else {
          console.error(`Sprawdzenie nieudane: ${data.error || 'Nieznany błąd'}`);
          setPingStatus('error');
          setIsPinging(false);
        }
      } catch (error) {
        console.error("Błąd podczas sprawdzania połączenia:", error);
        setPingStatus('error');
        setIsPinging(false);
      }
    } catch (error) {
      console.error("Ogólny błąd podczas nawiązywania połączenia:", error);
      setPingStatus('error');
      setIsPinging(false);
    }
  };

  // Effect, który zmienia przezroczystość tła po udanym połączeniu
  useEffect(() => {
    console.log("Connection state changed:", { connected, connectionError });
    
    if (connected && !connectionError) {
      const timer1 = setTimeout(() => {
        console.log("Starting fade animation");
        setBackgroundOpacity(0);
      }, 1000);
      
      return () => clearTimeout(timer1);
    } else {
      console.log("Resetting background opacity");
      setBackgroundOpacity(1);
    }
  }, [connected, connectionError]);

  // Effect do ustawienia fullscreen po połączeniu
  useEffect(() => {
    if (connected && backgroundOpacity === 0) {
      // Usunięcie marginesów i paddingów z body i html
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.margin = '0';
      document.documentElement.style.padding = '0';
      document.documentElement.style.overflow = 'hidden';
      
      return () => {
        // Przywrócenie domyślnych stylów przy odmontowaniu
        document.body.style.margin = '';
        document.body.style.padding = '';
        document.body.style.overflow = '';
        document.documentElement.style.margin = '';
        document.documentElement.style.padding = '';
        document.documentElement.style.overflow = '';
      };
    }
  }, [connected, backgroundOpacity]);

  // Style kontenera formularza
  const containerCustomStyle = {
    opacity: backgroundOpacity,
    transform: `translate(-50%, -50%) ${backgroundOpacity === 0 ? 'scale(0.9)' : 'scale(1)'}`,
    visibility: backgroundOpacity > 0 ? 'visible' : 'hidden',
    ...(styles.container || {})
  };

  // Określenie klasy dla kontenera formularza
  const formContainerClass = `connection-form-container ${backgroundOpacity === 0 ? 'hidden' : 'visible'}`;

  return (
    <>
      {/* Tło z efektami podwodnymi */}
      <BackgroundEffects 
        backgroundOpacity={backgroundOpacity} 
        styles={styles} 
      />

      {/* Centralna część z formularzem i wskaźnikiem ładowania */}
      <div className={formContainerClass} style={containerCustomStyle}>
        {/* Checkbox trybu deweloperskiego */}
        <DevModeCheckbox 
          devMode={devMode} 
          onToggle={setDevMode} 
          style={styles.devModeCheckbox}
        />
        
        {/* Logo */}
        <Logo />
        
        {/* Formularz do wprowadzania adresu IP */}
        <IPForm 
          inputUrl={inputUrl}
          setInputUrl={setInputUrl}
          connecting={connecting}
          connected={connected}
          isPinging={isPinging}
          isValidIpAddress={isValidIpAddress}
          handleConnect={handleConnect}
          styles={styles}
        />

        {/* Wskaźnik statusu połączenia */}
        <ConnectionStatus 
          connecting={connecting}
          connected={connected}
          connectionError={connectionError}
          isPinging={isPinging}
          pingStatus={pingStatus}
          pingTime={pingTime}
          pingMethod={pingMethod}
          devMode={devMode}
          onForceConnect={forceConnect}
          styles={styles}
        />
      </div>
      
      {/* Komunikat o błędzie */}
      {connectionError && (
        <ConnectionError 
          inputUrl={inputUrl}
          onRetry={onRetry}
          styles={styles}
        />
      )}
    </>
  );
};

export default ConnectionForm;