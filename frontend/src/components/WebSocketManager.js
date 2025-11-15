import React, { useEffect, useRef, useState } from 'react';

const WebSocketContext = React.createContext({
  connected: false,
  messages: [],
  sendMessage: () => {},
  joystickValues: { leftX: 0, leftY: 0, rightX: 0, rightY: 0 },
  buttonValues: {
    // D-pad (hat)
    dpadUp: false,
    dpadDown: false,
    dpadLeft: false, 
    dpadRight: false,
    // Face buttons
    buttonTriangle: false, // PS: Triangle, Xbox: Y
    buttonCross: false,    // PS: Cross/X, Xbox: A
    buttonSquare: false,   // PS: Square, Xbox: X
    buttonCircle: false,   // PS: Circle, Xbox: B
    // Shoulder buttons
    l1: false,
    r1: false,
    l2: false,
    r2: false,
    // Other buttons
    select: false,
    start: false
  },
  systemStats: { cpu_usage: 0, temperature: 0, timestamp: 0 },
  mpuData: { 
    accel_x: 0, accel_y: 0, accel_z: 0, 
    gyro_x: 0, gyro_y: 0, gyro_z: 0, 
    temp: 0, timestamp: 0 
  },
  voltageData: {
    voltage: 0,
    timestamp: 0
  },
  orientation: {
    roll: 0,
    pitch: 0,
    yaw: 0,
    timestamp: 0
  }
});

export const useWebSocket = () => React.useContext(WebSocketContext);

export const WebSocketProvider = ({ children, url = 'ws://192.168.1.100:8000/ws' }) => {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [joystickValues, setJoystickValues] = useState({ leftX: 0, leftY: 0, rightX: 0, rightY: 0 });
  const [buttonValues, setButtonValues] = useState({
    dpadUp: false,
    dpadDown: false,
    dpadLeft: false, 
    dpadRight: false,
    buttonTriangle: false,
    buttonCross: false,
    buttonSquare: false,
    buttonCircle: false,
    l1: false,
    r1: false,
    l2: false,
    r2: false,
    select: false,
    start: false
  });
  const [systemStats, setSystemStats] = useState({ cpu_usage: 0, temperature: 0, timestamp: 0 });
  const [mpuData, setMpuData] = useState({ 
    accel_x: 0, accel_y: 0, accel_z: 0, 
    gyro_x: 0, gyro_y: 0, gyro_z: 0, 
    temp: 0, timestamp: 0 
  });
  
  const [orientation, setOrientation] = useState({
    roll: 0,
    pitch: 0,
    yaw: 0,
    timestamp: 0
  });

  const [voltageData, setVoltageData] = useState({
    voltage: 0,
    timestamp: 0
  });
  
  const ws = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const lastMessageTimeRef = useRef(Date.now());
  const isReconnectingRef = useRef(false);
  
  // Funkcja do wysyłania wiadomości
  const sendMessage = (data) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(JSON.stringify(data));
        return true;
      } catch (e) {
        console.warn('Błąd podczas wysyłania wiadomości WebSocket:', e);
        return false;
      }
    }
    
    // Nie loguj ostrzeżenia, jeśli aktualnie próbujemy ponownie połączyć
    if (!isReconnectingRef.current) {
      console.warn('WebSocket nie jest podłączony. Wiadomość nie została wysłana.');
    }
    return false;
  };
  
  // Funkcja przeliczająca dane MPU na orientację (roll, pitch, yaw)
  const calculateOrientation = (accelData, gyroData, dt) => {
    // Obliczanie kątów na podstawie akcelerometru
    // Roll (oś X) - obrót wokół osi przód-tył
    const accelRoll = Math.atan2(accelData.y, accelData.z) * (180 / Math.PI);
    
    // Pitch (oś Y) - obrót wokół osi lewo-prawo
    const accelPitch = Math.atan2(-accelData.x, 
                                Math.sqrt(accelData.y * accelData.y + accelData.z * accelData.z)) 
                                * (180 / Math.PI);
    
    // Yaw (oś Z) - obrót wokół osi góra-dół
    // Yaw nie może być określony tylko z akcelerometru,
    // można by użyć magnetometru lub integracji danych z żyroskopu
    
    // W rzeczywistości należałoby użyć filtru komplementarnego lub Kalmana
    // do połączenia danych z akcelerometru i żyroskopu
    
    return {
      roll: parseFloat(accelRoll.toFixed(2)),
      pitch: parseFloat(accelPitch.toFixed(2)),
      yaw: 0, // brak dokładnego yaw bez magnetometru
      timestamp: Date.now() / 1000
    };
  };
  
  // Funkcja do ponownego połączenia z backoff
  const reconnect = () => {
    // Nie uruchamiaj ponownego łączenia, jeśli już jest w trakcie
    if (isReconnectingRef.current) {
      return;
    }
    
    isReconnectingRef.current = true;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Wykładniczy backoff z maksymalnym limitem i losowością (jitter)
    const baseDelay = Math.min(30000, Math.pow(1.5, reconnectAttempt) * 1000);
    const jitter = Math.random() * 1000; // Dodaje losowość do 1 sekundy
    const delay = baseDelay + jitter;
    
    console.log(`Próba ponownego połączenia za ${(delay/1000).toFixed(1)} sekund... (próba ${reconnectAttempt + 1})`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempt(prev => prev + 1);
      isReconnectingRef.current = false;
      connectWebSocket();
    }, delay);
  };
  
  // Funkcja do wysyłania pingów, aby utrzymać połączenie
  const startPingInterval = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    // Ping co 15 sekund zamiast 30 dla szybszego wykrywania problemów
    pingIntervalRef.current = setInterval(() => {
      // Sprawdź, czy czas od ostatniej wiadomości nie jest zbyt długi (60 sekund)
      const timeSinceLastMessage = Date.now() - lastMessageTimeRef.current;
      
      if (timeSinceLastMessage > 60000) {
        console.warn(`Brak odpowiedzi z serwera przez ${timeSinceLastMessage/1000}s. Resetowanie połączenia...`);
        
        // Zamknij połączenie i wymuś reconnect
        if (ws.current) {
          try {
            ws.current.close();
          } catch (e) {
            console.error('Błąd podczas zamykania WebSocket:', e);
          }
        }
        
        setConnected(false);
        if (!isReconnectingRef.current) {
          reconnect();
        }
        return;
      }
      
      // Próba wysłania pinga tylko jeśli połączenie jest otwarte
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        try {
          ws.current.send(JSON.stringify({ 
            ping: true, 
            timestamp: Date.now(),
            client_id: 'frontend-app' // Dodane ID klienta dla lepszej diagnostyki
          }));
        } catch (e) {
          console.warn('Błąd podczas wysyłania ping:', e);
        }
      }
    }, 15000);
  };
  
  // Główna funkcja do łączenia z WebSocket
  const connectWebSocket = () => {
    // Jeśli już mamy otwarte połączenie, nie tworzymy nowego
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log('Już mamy otwarte połączenie WebSocket. Pomijanie próby połączenia.');
      isReconnectingRef.current = false;
      return;
    }
    
    // Zamknij istniejące połączenie (jeśli istnieje)
    if (ws.current) {
      try {
        ws.current.close();
      } catch (e) {
        console.error('Błąd podczas zamykania istniejącego WebSocket:', e);
      }
      ws.current = null;
    }
    
    try {
      console.log(`Łączenie z WebSocket: ${url}`);
      const socket = new WebSocket(url);
      
      socket.onopen = () => {
        console.log('WebSocket połączony');
        setConnected(true);
        setReconnectAttempt(0); // Resetuj licznik prób po udanym połączeniu
        lastMessageTimeRef.current = Date.now(); // Zresetuj licznik czasu
        isReconnectingRef.current = false;
        startPingInterval();
        
        // Wyślij aktualne wartości joysticka i przycisków po ponownym połączeniu
        if (Object.values(joystickValues).some(v => v !== 0) || Object.values(buttonValues).some(v => v === true)) {
          try {
            socket.send(JSON.stringify({ 
              joystick: joystickValues,
              buttons: buttonValues
            }));
          } catch (e) {
            console.warn('Błąd podczas wysyłania wartości kontrolera po ponownym połączeniu:', e);
          }
        }
      };
      
      socket.onmessage = (event) => {
        try {
          // Aktualizuj czas ostatniej wiadomości
          lastMessageTimeRef.current = Date.now();
          
          const data = JSON.parse(event.data);
          
          // Zapisz wiadomość w historii (tylko istotne wiadomości, nie pingi)
          if (data.type !== 'ping' && data.type !== 'pong') {
            setMessages(prev => [...prev.slice(-99), data]);
          }
          
          // Obsługa różnych typów wiadomości
          if (data.type === 'joystick_update' && data.data) {
            setJoystickValues(data.data);
          } 
          else if (data.type === 'buttons_update' && data.data) {
            setButtonValues(data.data);
          }
          else if (data.type === 'system_stats_update' && data.data) {
            setSystemStats(data.data);
          }
          else if (data.type === 'mpu_data_update' && data.data) {
            // Aktualizuj dane MPU
            setMpuData(data.data);
            
            // Oblicz orientację z nowych danych
            const newOrientation = calculateOrientation({
              x: data.data.accel_x,
              y: data.data.accel_y,
              z: data.data.accel_z
            }, {
              x: data.data.gyro_x,
              y: data.data.gyro_y,
              z: data.data.gyro_z
            }, 0.1); // Zakładamy dt = 0.1s
            
            setOrientation(newOrientation);
          }
           // Obsługa aktualizacji napięcia
           else if (data.type === 'voltage_update' && data.data) {
            setVoltageData(data.data);
          }
          // Obsługa aktualizacji napięcia
          else if (data.type === 'voltage_update' && data.data) {
            setVoltageData(data.data);
          }
          else if (data.type === 'heartbeat' || data.type === 'ping') {
            // Odpowiedź na heartbeat/ping od serwera
            try {
              socket.send(JSON.stringify({ 
                type: 'pong', 
                timestamp: Date.now() 
              }));
            } catch (e) {
              console.warn('Błąd podczas odpowiadania na heartbeat:', e);
            }
          }
        } catch (e) {
          console.error('Błąd podczas przetwarzania wiadomości WebSocket:', e);
        }
      };
      
      socket.onclose = (event) => {
        // Ignoruj zdarzenia zamykania dla starych socketów
        if (socket !== ws.current) {
          return;
        }
        
        console.log(`WebSocket zamknięty: kod=${event.code}, powód=${event.reason || 'brak powodu'}`);
        setConnected(false);
        
        // Nie próbuj ponownie łączyć jeśli zamknięcie było czyste i zamierzone
        if (event.wasClean && (event.code === 1000 || event.code === 1001)) {
          console.log('Czyste zamknięcie WebSocket, nie próbuję ponownie łączyć');
          return;
        }
        
        // Rozpocznij proces ponownego łączenia
        if (!isReconnectingRef.current) {
          reconnect();
        }
      };
      
      socket.onerror = (error) => {
        console.error('Błąd WebSocket:', error);
        // Nie robimy tu nic, ponieważ onclose i tak zostanie wywołany po błędzie
      };
      
      ws.current = socket;
    } catch (error) {
      console.error('Błąd podczas tworzenia połączenia WebSocket:', error);
      setConnected(false);
      if (!isReconnectingRef.current) {
        reconnect();
      }
    }
  };
  
  // Inicjalizacja połączenia
  useEffect(() => {
    connectWebSocket();
    
    // Funkcja czyszcząca
    return () => {
      // Wskaż, że zamknięcie jest zamierzone
      isReconnectingRef.current = true;
      
      if (ws.current) {
        try {
          ws.current.close(1000, 'Component unmounted');
        } catch (e) {
          console.error('Błąd podczas zamykania WebSocket przy odmontowaniu:', e);
        }
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [url]);
  
  const value = {
    connected,
    messages,
    sendMessage,
    joystickValues,
    buttonValues,
    systemStats,
    mpuData,
    orientation,
    voltageData
  };
  
  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};