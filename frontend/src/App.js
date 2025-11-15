import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css'
import ExternalPageViewer from '../../frontend/src/components/ExternalPageViewer';
import { WebSocketProvider } from '../../frontend/src/components/WebSocketManager';
import RightSidePanel from '../../frontend/src/components/RightSidePanel';
import MPUOrientationDisplay from '../../frontend/src/components/MPUOrientationDisplay';

function App() {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', description: '' });
  const [backendStatus, setBackendStatus] = useState('checking');

  useEffect(() => {
    // Sprawdzenie statusu backendu
    const checkBackendStatus = async () => {
      try {
        await axios.get('http://192.168.137.2:8000/api/system-stats');
        setBackendStatus('connected');
      } catch (error) {
        console.error('Błąd podczas łączenia z backendem:', error);
        setBackendStatus('disconnected');
      }
    };

    checkBackendStatus();
    // Sprawdzaj status co 5 sekund
    const intervalId = setInterval(checkBackendStatus, 5000);

    return () => clearInterval(intervalId);
  }, []);

  // Pobieranie przykładowych danych tylko gdy backend jest dostępny
  useEffect(() => {
    if (backendStatus === 'connected') {
      // Pobieranie danych z backendu Python
      axios.get('http://192.168.137.2:8000/api/items')
        .then(response => setItems(response.data))
        .catch(error => console.error(error));
    }
  }, [backendStatus]);

  const addItem = () => {
    axios.post('http://192.168.137.2:8000/api/items', newItem)
      .then(response => {
        setItems([...items, response.data]);
        setNewItem({ name: '', description: '' });
      })
      .catch(error => console.error(error));
  };

  return (
    <WebSocketProvider url="ws://192.168.137.2:8000/ws">
      <div>
        {/* Komponent wyświetlający stronę i formularz połączenia
            - renderowany jako pierwszy, aby był na samym dole */}
        <ExternalPageViewer initialUrl="192.168.1.46:8889/cam1" />
        
        {/* Panele boczne renderowane po ExternalPageViewer, 
            ale przed warstwą formularza w ExternalPageViewer */}
        
        {/* Panel boczny po prawej stronie */}
        <RightSidePanel
          initialOpacity={0.9}
          backgroundColor="#2d3748"
          width="250px"
          zIndex={10} // Niższy z-index, aby być pod animowanym tłem
          position="right"
          style={{
            boxShadow: '-2px 0 10px rgba(0, 0, 0, 0.3)',
            borderLeft: '1px solid #1e293b'
          }}
        />
        
        {/* Panel boczny po lewej stronie z danymi MPU */}
        <RightSidePanel
          initialOpacity={0.9}
          backgroundColor="#2d3748"
          width="250px"
          zIndex={10} // Niższy z-index, aby być pod animowanym tłem
          position="left"
          style={{
            boxShadow: '2px 0 10px rgba(0, 0, 0, 0.3)',
            borderRight: '1px solid #1e293b'
          }}
        >
          <div>
            <MPUOrientationDisplay />
          </div>
        </RightSidePanel>
        
        {/* Opcjonalnie możemy wyświetlić status połączenia z backendem */}
        {backendStatus !== 'connected' && (
          <div 
            style={{
              position: 'fixed',
              bottom: 20,
              left: 20,
              backgroundColor: 'rgba(255, 0, 0, 0.7)',
              padding: '10px 20px',
              borderRadius: 5,
              color: 'white',
              zIndex: 9999
            }}
          >
            Backend niedostępny - funkcje joysticka mogą nie działać
          </div>
        )}
      </div>
    </WebSocketProvider>
  );
}

export default App;