from fastapi import WebSocket
from typing import List, Dict, Any, Optional
import asyncio
import time
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.client_ids: Dict[WebSocket, str] = {}  # Mapowanie WebSocket na client_id
        self.last_activity: Dict[WebSocket, float] = {}  # Czas ostatniej aktywności dla każdego klienta
        
        # Joystick data
        self.last_joystick_values = {
            "leftX": 0.0,
            "leftY": 0.0,
            "rightX": 0.0,
            "rightY": 0.0
        }
        
        # Button data
        self.last_button_values = {
            "dpadUp": False,
            "dpadDown": False,
            "dpadLeft": False, 
            "dpadRight": False,
            "buttonTriangle": False,
            "buttonCross": False,
            "buttonSquare": False,
            "buttonCircle": False,
            "l1": False,
            "r1": False,
            "l2": False,
            "r2": False,
            "select": False,
            "start": False
        }
        
        # Dodanie obiektu do przechowywania statystyk systemowych
        self.system_stats = {
            "cpu_usage": 0.0,
            "temperature": 0.0,
            "timestamp": 0.0
        }
        # Lock do bezpiecznej modyfikacji list i słowników
        self.lock = asyncio.Lock()
        # Flaga wskazująca, czy mechanizm ponownego połączenia jest aktywny
        self.reconnect_task = None
        self.ping_task = None

    async def connect(self, websocket: WebSocket, client_id: str = "unknown"):
        """
        Obsługuje nowe połączenie WebSocket.
        
        Args:
            websocket (WebSocket): Obiekt połączenia WebSocket
            client_id (str): Identyfikator klienta dla lepszego śledzenia
        """
        await websocket.accept()
        
        async with self.lock:
            self.active_connections.append(websocket)
            self.client_ids[websocket] = client_id
            self.last_activity[websocket] = time.time()
        
        client_count = len(self.active_connections)
        print(f"Nowe połączenie WebSocket (id: {client_id}). Aktywne połączenia: {client_count}")
        
        # Wyślij aktualne dane po połączeniu
        try:
            # Wyślij aktualne wartości joysticka
            await websocket.send_json({
                "type": "joystick_update",
                "data": self.last_joystick_values
            })
            
            # Wyślij aktualne wartości przycisków
            await websocket.send_json({
                "type": "buttons_update",
                "data": self.last_button_values
            })
            
            # Wyślij aktualne statystyki systemowe
            await websocket.send_json({
                "type": "system_stats_update",
                "data": self.system_stats
            })
            
            # Wyślij status połączenia
            await websocket.send_json({
                "type": "connection_status",
                "status": "connected",
                "message": "Połączono z serwerem",
                "client_id": client_id,
                "timestamp": time.time()
            })
        except Exception as e:
            print(f"Błąd podczas wysyłania początkowych danych ({client_id}): {e}")

        # Upewnij się, że ping task jest uruchomiony
        if self.ping_task is None or self.ping_task.done():
            self.ping_task = asyncio.create_task(self._ping_clients())

    def disconnect(self, websocket: WebSocket):
        """
        Obsługuje rozłączenie WebSocket.
        
        Args:
            websocket (WebSocket): Obiekt połączenia WebSocket do rozłączenia
        """
        client_id = "unknown"
        
        try:
            async def _disconnect():
                nonlocal client_id
                async with self.lock:
                    if websocket in self.active_connections:
                        client_id = self.client_ids.get(websocket, "unknown")
                        self.active_connections.remove(websocket)
                        
                        # Usuń informacje o kliencie
                        if websocket in self.client_ids:
                            del self.client_ids[websocket]
                        if websocket in self.last_activity:
                            del self.last_activity[websocket]
            
            # Utwórz i uruchom zadanie, ale nie czekaj na jego zakończenie
            asyncio.create_task(_disconnect())
        except Exception as e:
            print(f"Błąd podczas rozłączania WebSocket ({client_id}): {e}")
        
        remaining = len(self.active_connections)
        print(f"Rozłączono WebSocket (id: {client_id}). Pozostałe połączenia: {remaining}")

    async def _ping_clients(self):
        """
        Wysyła regularne pingi do klientów, aby utrzymać połączenie.
        Sprawdza też nieaktywne połączenia i usuwa je.
        """
        while True:
            await asyncio.sleep(30)  # Ping co 30 sekund
            
            if not self.active_connections:
                continue
            
            current_time = time.time()
            to_remove = []
                
            # Sprawdź i usuń nieaktywne połączenia (>2 minuty bez aktywności)
            async with self.lock:
                for ws, last_active in list(self.last_activity.items()):
                    if current_time - last_active > 120:  # 2 minuty
                        client_id = self.client_ids.get(ws, "unknown")
                        print(f"Usuwanie nieaktywnego połączenia (id: {client_id}, nieaktywne od {int(current_time - last_active)}s)")
                        to_remove.append(ws)
            
            # Usuń nieaktywne połączenia
            for ws in to_remove:
                self.disconnect(ws)
                
            # Wyślij ping do aktywnych klientów
            ping_message = json.dumps({
                "type": "ping", 
                "timestamp": current_time,
                "client_count": len(self.active_connections)
            })
            
            await self.broadcast(ping_message)
            print(f"Wysłano ping do {len(self.active_connections)} klientów")

    async def broadcast(self, message: str):
        """
        Bezpiecznie wysyła wiadomość do wszystkich połączonych klientów.
        Automatycznie usuwa rozłączone połączenia.
        
        Args:
            message (str): Wiadomość do wysłania
        """
        if not self.active_connections:
            return
            
        # Kopiujemy listę połączeń, aby uniknąć problemów podczas modyfikacji
        async with self.lock:
            connections = list(self.active_connections)
            
        to_remove = []
        
        for connection in connections:
            try:
                await connection.send_text(message)
                # Aktualizuj czas ostatniej aktywności
                async with self.lock:
                    if connection in self.last_activity:
                        self.last_activity[connection] = time.time()
            except Exception as e:
                client_id = self.client_ids.get(connection, "unknown")
                error_name = type(e).__name__
                print(f"Błąd podczas broadcastu do {client_id}: {error_name} - {str(e)}")
                to_remove.append(connection)
        
        # Usuwamy problematyczne połączenia
        for conn in to_remove:
            client_id = self.client_ids.get(conn, "unknown")
            self.disconnect(conn)
            print(f"Usunięto niepoprawne połączenie WebSocket (id: {client_id})")

    async def broadcast_json(self, data: Dict[str, Any]):
        """
        Wysyła dane JSON do wszystkich klientów.
        
        Args:
            data (Dict[str, Any]): Dane JSON do wysłania
        """
        if not self.active_connections:
            return
            
        try:
            message = json.dumps(data)
            await self.broadcast(message)
        except Exception as e:
            print(f"Błąd podczas konwersji JSON do broadcastu: {e}")
    
    def update_joystick_values(self, values: dict):
        """
        Aktualizuje wartości joysticka i powiadamia klientów.
        
        Args:
            values (dict): Nowe wartości joysticka
        """
        try:
            self.last_joystick_values = values
            
            # Asynchronicznie powiadom klientów o aktualizacji
            asyncio.create_task(self.broadcast_json({
                "type": "joystick_update",
                "data": values,
                "timestamp": time.time()
            }))
        except Exception as e:
            print(f"Błąd podczas aktualizacji wartości joysticka: {e}")
    
    def update_button_values(self, values: dict):
        """
        Aktualizuje wartości przycisków i powiadamia klientów.
        
        Args:
            values (dict): Nowe wartości przycisków
        """
        try:
            self.last_button_values = values
            
            # Asynchronicznie powiadom klientów o aktualizacji
            asyncio.create_task(self.broadcast_json({
                "type": "buttons_update",
                "data": values,
                "timestamp": time.time()
            }))
        except Exception as e:
            print(f"Błąd podczas aktualizacji wartości przycisków: {e}")
    
    def get_joystick_values(self):
        """
        Pobiera aktualne wartości joysticka.
        
        Returns:
            dict: Aktualne wartości joysticka
        """
        return self.last_joystick_values
    
    def get_button_values(self):
        """
        Pobiera aktualne wartości przycisków.
        
        Returns:
            dict: Aktualne wartości przycisków
        """
        return self.last_button_values
        
    def update_system_stats(self, stats: dict):
        """
        Aktualizuje statystyki systemowe i powiadamia klientów.
        
        Args:
            stats (dict): Nowe statystyki systemowe
        """
        try:
            self.system_stats = stats
            
            # Asynchronicznie powiadom klientów o aktualizacji
            asyncio.create_task(self.broadcast_json({
                "type": "system_stats_update",
                "data": stats,
                "timestamp": time.time()
            }))
        except Exception as e:
            print(f"Błąd podczas aktualizacji statystyk systemowych: {e}")
        
    def get_system_stats(self):
        """
        Pobiera aktualne statystyki systemowe.
        
        Returns:
            dict: Aktualne statystyki systemowe
        """
        return self.system_stats

    async def send_to_client(self, websocket: WebSocket, data: Dict[str, Any]):
        """
        Wysyła dane do konkretnego klienta.
        
        Args:
            websocket (WebSocket): Obiekt połączenia WebSocket
            data (Dict[str, Any]): Dane do wysłania
            
        Returns:
            bool: True jeśli wysłanie się powiodło, False w przeciwnym razie
        """
        try:
            await websocket.send_json(data)
            # Aktualizuj czas ostatniej aktywności
            async with self.lock:
                if websocket in self.last_activity:
                    self.last_activity[websocket] = time.time()
            return True
        except Exception as e:
            client_id = self.client_ids.get(websocket, "unknown")
            print(f"Błąd podczas wysyłania do klienta {client_id}: {e}")
            return False

# Inicjalizacja managera połączeń (singleton)
connection_manager = ConnectionManager()