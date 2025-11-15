# SubSeaBot - Dokumentacja projektu

## Opis
SubSeaBot to aplikacja do sterowania robotem podwodnym, umożliwiająca nawiązywanie połączenia z kamerą, sterowanie za pomocą joysticka oraz monitorowanie parametrów systemu.

## Struktura katalogów i plików

```
src/
├── App.css                      # Style głównego komponentu aplikacji
├── App.js                       # Główny komponent aplikacji
├── App.test.js                  # Testy dla głównego komponentu
├── backend/                     # Kod backendu (FastAPI)
│   ├── main.py                  # Główny plik backendu
│   ├── models.py                # Modele danych
│   ├── routes/                  # Endpointy API
│   │   ├── __init__.py         # Inicjalizacja routerów
│   │   ├── items.py            # Router dla przykładowych przedmiotów
│   │   ├── joystick.py         # Router dla sterowania joystickiem
│   │   ├── ping.py             # Router dla sprawdzania dostępności hostów
│   │   ├── system.py           # Router dla statystyk systemowych
│   │   └── websocket.py        # Router dla komunikacji WebSocket
│   └── services/                # Usługi backendu
│       ├── __init__.py         # Inicjalizacja pakietu services
│       ├── connection_manager.py # Menedżer połączeń
│       ├── ping_service.py     # Usługa sprawdzania dostępności hostów
│       ├── socket_service.py   # Usługa komunikacji socketowej
│       └── system_stats.py     # Usługa statystyk systemowych
├── components/                  # Komponenty React
│   ├── animations.css          # Definicje animacji CSS
│   ├── BackgroundEffects.js    # Efekty tła (bąbelki, promienie światła)
│   ├── colors.js               # Definicje kolorów
│   ├── ConnectionError.js      # Komunikat o błędzie połączenia
│   ├── ConnectionForm.css      # Style formularza połączenia
│   ├── ConnectionForm.js       # Formularz nawiązywania połączenia
│   ├── ConnectionStatus.css    # Style wskaźnika statusu połączenia
│   ├── ConnectionStatus.js     # Wskaźnik statusu połączenia
│   ├── DevModeCheckbox.css     # Style przełącznika trybu deweloperskiego
│   ├── DevModeCheckbox.js      # Przełącznik trybu deweloperskiego
│   ├── ExternalPageViewer.css  # Style komponentu wyświetlającego zewnętrzną stronę
│   ├── ExternalPageViewer.js   # Komponent wyświetlający zewnętrzną stronę
│   ├── IframeViewer.css        # Style komponentu iframe
│   ├── IframeViewer.js         # Komponent iframe
│   ├── IPForm.css              # Style formularza wprowadzania IP
│   ├── IPForm.js               # Formularz wprowadzania IP
│   ├── Logo.css                # Style logo
│   ├── Logo.js                 # Komponent logo
│   ├── RightSidePanel.css      # Style prawego panelu bocznego
│   ├── RightSidePanel.js       # Prawy panel boczny z kontrolkami
│   ├── SystemMonitor.css       # Style monitora systemu
│   └── SystemMonitor.js        # Monitor parametrów systemu
├── index.css                   # Globalne style CSS
├── index.js                    # Punkt wejściowy aplikacji
├── logo.svg                    # Logo React
├── reportWebVitals.js          # Raportowanie metryk wydajności
└── setupTests.js               # Konfiguracja testów
```

## Spis funkcji według plików

### src/App.js
- `App()` - Główny komponent aplikacji

### src/backend/main.py
- `startup_event()` - Inicjalizacja połączenia socketowego przy starcie aplikacji

### src/backend/models.py
- Klasa `Item` - Model przedmiotu
- Klasa `SystemStats` - Model statystyk systemowych
- Klasa `PingRequest` - Model żądania ping
- Klasa `JoystickValues` - Model wartości joysticka

### src/backend/routes/items.py
- `get_items()` - Pobieranie listy przedmiotów
- `create_item()` - Tworzenie nowego przedmiotu

### src/backend/routes/joystick.py
- `update_joystick()` - Aktualizacja wartości joysticka
- `get_joystick()` - Pobieranie aktualnych wartości joysticka

### src/backend/routes/ping.py
- `ping()` - Endpoint do sprawdzania dostępności adresu IP lub hosta

### src/backend/routes/system.py
- `get_system_stats()` - Pobieranie statystyk systemowych (CPU, temperatura)

### src/backend/routes/websocket.py
- `websocket_endpoint()` - Endpoint WebSocket do komunikacji dwukierunkowej

### src/backend/services/connection_manager.py
- Klasa `ConnectionManager` - Zarządzanie połączeniami WebSocket
  - `connect()` - Nawiązanie połączenia WebSocket
  - `disconnect()` - Rozłączenie WebSocket
  - `broadcast()` - Wysyłanie wiadomości do wszystkich klientów
  - `update_joystick_values()` - Aktualizacja wartości joysticka
  - `get_joystick_values()` - Pobieranie wartości joysticka
  - `update_system_stats()` - Aktualizacja statystyk systemowych
  - `get_system_stats()` - Pobieranie statystyk systemowych

### src/backend/services/ping_service.py
- `check_host_availability()` - Sprawdzanie dostępności hosta
- `ping_host()` - Wykonywanie standardowego pingu (ICMP)
- `check_host_tcp()` - Sprawdzanie dostępności hosta przez TCP

### src/backend/services/socket_service.py
- `initialize_socket()` - Inicjalizacja połączenia socketowego z kontrolerem
- `process_telemetry_data()` - Przetwarzanie danych telemetrycznych
- `receive_controller_data()` - Odbieranie danych z kontrolera
- `periodic_joystick_update()` - Okresowe wysyłanie wartości joysticka
- `send_joystick_values_async()` - Asynchroniczne wysyłanie wartości joysticka
- `send_joystick_values()` - Synchroniczne wysyłanie wartości joysticka
- `is_controller_connected()` - Sprawdzanie stanu połączenia
- `update_connection_status()` - Aktualizacja statusu połączenia

### src/backend/services/system_stats.py
- `generate_system_stats()` - Generowanie symulowanych statystyk systemowych

### src/components/BackgroundEffects.js
- `BackgroundEffects()` - Komponent renderujący efekty tła

### src/components/ConnectionError.js
- `ConnectionForm()` - Formularz połączenia (możliwa duplikacja pliku)

### src/components/ConnectionForm.js
- `ConnectionForm()` - Formularz nawiązywania połączenia
  - `isValidIpAddress()` - Walidacja adresu IP
  - `forceConnect()` - Wymuszenie połączenia mimo błędu
  - `handleConnect()` - Obsługa nawiązywania połączenia

### src/components/ConnectionStatus.js
- `ConnectionStatus()` - Komponent wskaźnika statusu połączenia
  - `handleForceConnect()` - Obsługa kliknięcia "Połącz mimo to"
  - `renderPingInfo()` - Renderowanie informacji o pingu

### src/components/DevModeCheckbox.js
- `DevModeCheckbox()` - Przełącznik trybu deweloperskiego

### src/components/ExternalPageViewer.js
- `ExternalPageViewer()` - Główny komponent wyświetlający zewnętrzną stronę
  - `handleConnect()` - Obsługa połączenia
  - `handleIframeError()` - Obsługa błędu ładowania iframe
  - `handleRetry()` - Obsługa ponownej próby połączenia

### src/components/IframeViewer.js
- `IframeViewer()` - Komponent wyświetlający stronę w iframe

### src/components/IPForm.js
- `IPForm()` - Formularz wprowadzania adresu IP
  - `getButtonText()` - Określenie tekstu przycisku

### src/components/Logo.js
- `Logo()` - Komponent wyświetlający logo aplikacji

### src/components/RightSidePanel.js
- `RightSidePanel()` - Prawy panel boczny
  - `sendJoystickValues()` - Wysyłanie wartości joysticka przez WebSocket
  - `sendJoystickValuesREST()` - Wysyłanie wartości joysticka przez REST API
  - `handleOpacityChange()` - Obsługa zmiany przezroczystości panelu
  - `mapJoystickToSlider()` - Mapowanie wartości joysticka na wartość suwaka

### src/components/SystemMonitor.js
- `SystemMonitor()` - Monitor parametrów systemu
  - `fetchSystemStats()` - Pobieranie statystyk systemowych
  - `setupWebSocket()` - Inicjalizacja WebSocket
  - `getCpuUsageColor()` - Określanie koloru wskaźnika CPU
  - `getTemperatureColor()` - Określanie koloru wskaźnika temperatury
  - `getLastUpdateTime()` - Formatowanie czasu ostatniej aktualizacji

### src/reportWebVitals.js
- `reportWebVitals()` - Raportowanie metryk wydajności