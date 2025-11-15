import socket
import json
import asyncio
import time
import re
from typing import Dict, Any, Optional, Tuple
from services.connection_manager import connection_manager
from models import GamepadData

# Konfiguracja połączenia z kontrolerem
CONTROLLER_HOST = "localhost"  # Adres kontrolera
CONTROLLER_PORT = 9998  # Port kontrolera

# Globalny socket do komunikacji z kontrolerem
controller_socket: Optional[socket.socket] = None
is_connected = False
connection_lock = asyncio.Lock()  # Lock dla operacji na socketach

# Flaga do śledzenia, czy frontend wysłał ostatnio wartości joysticka
last_frontend_update = 0  # timestamp ostatniej aktualizacji z frontendu
frontend_timeout = 2.0    # czas w sekundach, po którym uznajemy, że frontend nie aktualizuje

# Domyślne wartości joysticka
DEFAULT_JOYSTICK_VALUES = {
    "leftX": 0.0,
    "leftY": 0.0,
    "rightX": 0.0,
    "rightY": 0.0
}

# Domyślne wartości przycisków
DEFAULT_BUTTON_VALUES = {
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

# Licznik nieudanych prób połączenia
connection_failure_count = 0
max_connection_failures = 5  # Po ilu nieudanych próbach zrobić dłuższą przerwę

async def initialize_socket():
    """
    Inicjalizuje połączenie socketowe z kontrolerem.
    Będzie automatycznie próbować ponownego połączenia w przypadku utraty połączenia.
    """
    global controller_socket, is_connected, connection_failure_count
    
    # Uruchom wątek dla automatycznego wysyłania wartości joysticka
    asyncio.create_task(periodic_gamepad_update())
    
    # Uruchom wątek aktualizacji statusu połączenia dla klientów
    asyncio.create_task(update_connection_status())
    
    # Uruchom wątek odbierania danych z kontrolera
    asyncio.create_task(receive_controller_data())
    
    # Zmienne do zarządzania ponawianiem połączenia
    consecutive_failures = 0
    backoff_time = 1  # Początkowy czas oczekiwania w sekundach
    
    while True:
        try:
            # Użyj locka do bezpiecznej modyfikacji zmiennych globalnych
            async with connection_lock:
                # Zamknij poprzednie połączenie, jeśli istnieje
                if controller_socket:
                    try:
                        controller_socket.close()
                    except:
                        pass
                    controller_socket = None
                    is_connected = False
                
                print(f"Próba połączenia z kontrolerem na {CONTROLLER_HOST}:{CONTROLLER_PORT}...")
                # Utwórz nowe połączenie
                new_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                new_socket.settimeout(5)  # Timeout 5 sekund
                
                # Opcje dla niezawodnego połączenia
                new_socket.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
                # Ustaw TCP_KEEPIDLE - czas nieaktywności przed wysłaniem keepalive
                if hasattr(socket, 'TCP_KEEPIDLE'):
                    new_socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPIDLE, 30)
                # Ustaw TCP_KEEPINTVL - interwał między kolejnymi pakietami keepalive
                if hasattr(socket, 'TCP_KEEPINTVL'):
                    new_socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPINTVL, 5)
                # Ustaw TCP_KEEPCNT - liczba pakietów keepalive przed uznaniem rozłączenia
                if hasattr(socket, 'TCP_KEEPCNT'):
                    new_socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPCNT, 10)
                
                # Zwiększ stabilność połączenia 
                if hasattr(socket, 'TCP_USER_TIMEOUT'):
                    new_socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_USER_TIMEOUT, 10000)  # 10 sekund w milisekundach
                
                new_socket.connect((CONTROLLER_HOST, CONTROLLER_PORT))
                
                # Ustaw zmienne globalne
                controller_socket = new_socket
                is_connected = True
                # Zresetuj licznik błędów po udanym połączeniu
                connection_failure_count = 0
                consecutive_failures = 0
                backoff_time = 1  # Resetuj czas oczekiwania
            
            print(f"Połączono z kontrolerem na {CONTROLLER_HOST}:{CONTROLLER_PORT}")
            
            # Wyślij powiadomienie o statusie połączenia
            asyncio.create_task(
                connection_manager.broadcast_json({
                    "type": "controller_connection",
                    "status": "connected",
                    "timestamp": time.time()
                })
            )
            
            # Utrzymuj połączenie, sprawdzając co 1 sekundę
            heartbeat_interval = 1
            heartbeat_counter = 0
            max_silent_heartbeats = 5  # Zwiększono liczbę niepotwierdzonych heartbeat'ów
            
            while True:
                await asyncio.sleep(heartbeat_interval)
                
                # Sprawdź połączenie wysyłając heartbeat
                async with connection_lock:
                    if not is_connected or not controller_socket:
                        break
                    
                    try:
                        # Wyślij proste wartości joysticka jako heartbeat
                        heartbeat = "joystick1: 50, joystick2: 50, joystick3: 50, joystick4: 50"
                        controller_socket.send(heartbeat.encode('utf-8'))
                        
                        # Odbierz odpowiedź z krótkim timeoutem
                        controller_socket.settimeout(2)  # Zwiększony timeout
                        response = controller_socket.recv(1024).decode('utf-8')
                        
                        if not response:
                            heartbeat_counter += 1  # Brak odpowiedzi to problem
                            print(f"Brak odpowiedzi na heartbeat ({heartbeat_counter}/{max_silent_heartbeats})")
                            if heartbeat_counter >= max_silent_heartbeats:
                                print("Przekroczono maksymalną liczbę niepotwierdzonych heartbeat'ów")
                                raise Exception("Brak odpowiedzi na heartbeat")
                        else:
                            # Odpowiedź otrzymana, zresetuj licznik
                            heartbeat_counter = 0
                            
                            # Przetwórz dane telemetryczne z odpowiedzi
                            process_telemetry_data(response)
                    except Exception as e:
                        print(f"Błąd heartbeat: {e}")
                        # Zaznacz połączenie jako utracone
                        is_connected = False
                        break
        
        except (ConnectionRefusedError, socket.timeout) as e:
            print(f"Nie można połączyć się z kontrolerem: {e}")
            connection_failure_count += 1
            consecutive_failures += 1
            
            # Zastosuj wykładniczy backoff, ale z maksymalnym limitem
            backoff_time = min(30, backoff_time * 1.5)  # Maksymalnie 30 sekund przerwy
            
            # Wyślij powiadomienie o statusie połączenia
            asyncio.create_task(
                connection_manager.broadcast_json({
                    "type": "controller_connection",
                    "status": "disconnected",
                    "error": str(e),
                    "next_attempt": backoff_time,
                    "timestamp": time.time()
                })
            )
            
            async with connection_lock:
                is_connected = False
                if controller_socket:
                    try:
                        controller_socket.close()
                    except:
                        pass
                    controller_socket = None
            
            print(f"Ponowna próba połączenia za {backoff_time:.1f} sekund...")
            await asyncio.sleep(backoff_time)
            
        except Exception as e:
            print(f"Błąd połączenia z kontrolerem: {e}")
            connection_failure_count += 1
            consecutive_failures += 1
            
            # Zastosuj wykładniczy backoff, ale z maksymalnym limitem
            backoff_time = min(30, backoff_time * 1.5)
            
            # Wyślij powiadomienie o statusie połączenia
            asyncio.create_task(
                connection_manager.broadcast_json({
                    "type": "controller_connection",
                    "status": "error",
                    "error": str(e),
                    "next_attempt": backoff_time,
                    "timestamp": time.time()
                })
            )
            
            async with connection_lock:
                is_connected = False
                if controller_socket:
                    try:
                        controller_socket.close()
                    except:
                        pass
                    controller_socket = None
            
            print(f"Ponowna próba połączenia za {backoff_time:.1f} sekund...")
            await asyncio.sleep(backoff_time)

def process_telemetry_data(data: str):
    """
    Przetwarza dane telemetryczne odebrane z kontrolera.
    
    Args:
        data: Dane w formacie tekstowym odebrane z kontrolera
    """
    try:
        # Logowanie otrzymanych danych dla diagnostyki
        # print(f"Otrzymane dane telemetryczne: {data}")
        
        # Wykryj dane CPU i temperatury w otrzymanej odpowiedzi z Raspberry Pi
        # Format danych: CPU:50.5%,TEMP:45.2°C,J1:50,J2:50,J3:50,J4:50
        
        # Wzorzec dla CPU
        cpu_match = re.search(r'CPU:(\d+(\.\d+)?)%', data)
        
        # Wzorzec dla TEMP - dopasowanie do formatu z Raspberry Pi
        temp_match = re.search(r'TEMP:(\d+(\.\d+)?)°C', data)
        
        # Alternatywny wzorzec dla TEMP bez znaku stopnia
        if not temp_match:
            temp_match = re.search(r'TEMP:(\d+(\.\d+)?)', data)
        
        # Logowanie wyników dopasowania dla diagnostyki
        # print(f"Dopasowanie CPU: {cpu_match}")
        # print(f"Dopasowanie temperatury: {temp_match}")
        
        if cpu_match or temp_match:
            # Użyj wartości domyślnych, jeśli dane nie są dostępne
            cpu_value = float(cpu_match.group(1)) if cpu_match else 0.0
            temp_value = float(temp_match.group(1)) if temp_match else 0.0
            
            # Przygotuj dane telemetryczne
            system_stats = {
                "cpu_usage": cpu_value,
                "temperature": temp_value,
                "timestamp": time.time()
            }
            
            # Logowanie przetworzonych danych
            # print(f"Przetworzone dane telemetryczne: CPU={cpu_value}%, Temp={temp_value}°C")
            
            # Aktualizuj statystyki systemowe w connection_manager
            connection_manager.update_system_stats(system_stats)
            
            # Powiadom wszystkich klientów o aktualizacji danych telemetrycznych
            asyncio.create_task(
                connection_manager.broadcast_json({
                    "type": "system_stats_update", 
                    "data": system_stats
                })
            )
    except Exception as e:
        print(f"Błąd przetwarzania danych telemetrycznych: {e}")
        import traceback
        traceback.print_exc()  # Wypisz pełny stos błędu

async def receive_controller_data():
    """
    Dedykowany wątek do odbierania danych z kontrolera.
    Działa niezależnie od heartbeat i okresowo sprawdza, czy są nowe dane.
    """
    global controller_socket, is_connected
    
    reconnect_delay = 0.1  # Początkowe opóźnienie w sekundach
    max_reconnect_delay = 2.0  # Maksymalne opóźnienie
    
    while True:
        try:
            await asyncio.sleep(0.1)  # Krótka pauza między sprawdzeniami
            
            # Sprawdź, czy połączenie jest aktywne
            if not is_connected or not controller_socket:
                await asyncio.sleep(reconnect_delay)  # Rosnące opóźnienie przy braku połączenia
                reconnect_delay = min(max_reconnect_delay, reconnect_delay * 1.2)  # Wykładniczy backoff
                continue
            else:
                reconnect_delay = 0.1  # Zresetuj opóźnienie, gdy połączenie jest aktywne
                
            # Bezpiecznie sprawdź, czy są dane do odczytu
            async with connection_lock:
                if not is_connected or not controller_socket:
                    continue
                    
                try:
                    # Sprawdź, czy są dane do odczytu bez blokowania
                    controller_socket.settimeout(0.1)
                    controller_socket.setblocking(False)
                    
                    try:
                        # Próba odczytania danych
                        data = controller_socket.recv(1024).decode('utf-8')
                        
                        # Jeśli otrzymano dane, przetwórz je
                        if data:
                            # Przetwarzanie danych z kontrolera
                            process_telemetry_data(data)
                        
                    except (BlockingIOError, socket.timeout):
                        # Brak danych do odczytu, to normalne
                        pass
                    except Exception as e:
                        # Inne błędy związane z gniazdem - mogą wskazywać na problemy z połączeniem
                        print(f"Błąd odczytu danych z socketu: {e}")
                        if isinstance(e, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError)):
                            is_connected = False
                        
                except Exception as e:
                    # Inne błędy - ignoruj, aby nie przerwać wątku
                    pass
                
        except asyncio.CancelledError:
            # Anulowanie zadania
            break
        except Exception as e:
            # Inne wyjątki - loguj i kontynuuj
            print(f"Błąd w receive_controller_data: {e}")
            await asyncio.sleep(1)

async def periodic_gamepad_update():
    """
    Funkcja periodycznie wysyłająca aktualne wartości kontrolera (joystick i przyciski) do kontrolera.
    Jeśli frontend nie aktualizuje wartości, wysyła domyślne.
    Wysyła dane przy zmianie wartości lub co określony czas.
    """
    global last_frontend_update
    last_sent_joystick = None
    last_sent_buttons = None
    last_forced_send_time = time.time()
    FORCE_SEND_INTERVAL = 0.1  # Wymuś wysłanie co sekundę nawet bez zmian
    
    while True:
        try:
            current_time = time.time()
            
            # Sprawdź, czy jesteśmy połączeni z kontrolerem
            async with connection_lock:
                if not is_connected:
                    await asyncio.sleep(0.5)
                    continue
            
            # Pobierz wartości joysticka i przycisków z connection_manager
            joystick_values = connection_manager.get_joystick_values()
            button_values = connection_manager.get_button_values()
            
            # Flagi decydujące o wysłaniu danych
            need_to_send = False
            
            # Sprawdź, czy wartości się zmieniły
            if last_sent_joystick != joystick_values or last_sent_buttons != button_values:
                need_to_send = True
            
            # Wymuś wysłanie co określony czas
            if current_time - last_forced_send_time > FORCE_SEND_INTERVAL:
                need_to_send = True
                last_forced_send_time = current_time
            
            # Sprawdź, czy frontend aktualizuje wartości
            if current_time - last_frontend_update > frontend_timeout:
                # Frontend nie aktualizuje, użyj domyślnych wartości
                joystick_values = DEFAULT_JOYSTICK_VALUES
                button_values = DEFAULT_BUTTON_VALUES
                need_to_send = True
            
            # Wysłanie danych jeśli jest taka potrzeba
            if need_to_send:
                success = await send_gamepad_values_async(joystick_values, button_values)
                if success:
                    last_sent_joystick = joystick_values.copy()
                    last_sent_buttons = button_values.copy()
            
        except Exception as e:
            print(f"Błąd w periodic_gamepad_update: {e}")
        
        # Wykonuj co 100ms
        await asyncio.sleep(0.1)

async def send_gamepad_values_async(joystick_values: Dict[str, float], button_values: Dict[str, bool]) -> bool:
    """
    Asynchroniczna wersja funkcji wysyłającej wartości kontrolera (joystick i przyciski).
    Używa locka do bezpiecznego dostępu do socketa.
    """
    global controller_socket, is_connected
    
    async with connection_lock:
        if not is_connected or not controller_socket:
            return False
        
        try:
            # Przekształć wartości joysticka na format oczekiwany przez kontroler
            def transform_joystick_value(val):
                # Przekształć z zakresu -1.0 do 1.0 na zakres 0-99
                return int((val * 0.2 + 1.0) * 49.5)
            
            joystick1 = transform_joystick_value(joystick_values.get("leftX", 0.0))  # lewy joystick X
            joystick2 = transform_joystick_value(joystick_values.get("leftY", 0.0))  # lewy joystick Y
            joystick3 = transform_joystick_value(joystick_values.get("rightX", 0.0))  # prawy joystick X
            joystick4 = transform_joystick_value(joystick_values.get("rightY", 0.0))  # prawy joystick Y
            
            # Zbierz informacje o przyciskach
            button_info = ""
            
            # D-pad (hat)
            if button_values.get("dpadUp", False):
                button_info += "HAT_UP:1,"
            if button_values.get("dpadDown", False):
                button_info += "HAT_DOWN:1,"
            if button_values.get("dpadLeft", False):
                button_info += "HAT_LEFT:1,"
            if button_values.get("dpadRight", False):
                button_info += "HAT_RIGHT:1,"
                
            # Face buttons
            if button_values.get("buttonTriangle", False):
                button_info += "BTN_TRIANGLE:1,"
            if button_values.get("buttonCross", False):
                button_info += "BTN_CROSS:1,"
            if button_values.get("buttonSquare", False):
                button_info += "BTN_SQUARE:1,"
            if button_values.get("buttonCircle", False):
                button_info += "BTN_CIRCLE:1,"
                
            # Shoulder buttons
            if button_values.get("l1", False):
                button_info += "BTN_L1:1,"
            if button_values.get("r1", False):
                button_info += "BTN_R1:1,"
            if button_values.get("l2", False):
                button_info += "BTN_L2:1,"
            if button_values.get("r2", False):
                button_info += "BTN_R2:1,"
                
            # Other buttons
            if button_values.get("select", False):
                button_info += "BTN_SELECT:1,"
            if button_values.get("start", False):
                button_info += "BTN_START:1,"
            
            # Utwórz wiadomość w formacie oczekiwanym przez kontroler
            message = f"joystick1: {joystick1}, joystick2: {joystick2}, joystick3: {joystick3}, joystick4: {joystick4}"
            
            # Dodaj informacje o przyciskach, jeśli jakieś są wciśnięte
            if button_info:
                message += ", " + button_info[:-1]  # Usuń ostatni przecinek
            
            # Wyślij wiadomość
            controller_socket.settimeout(3)  # Dłuższy timeout dla wysyłania
            controller_socket.send(message.encode('utf-8'))
            
            # Czekaj na potwierdzenie z krótkim timeoutem
            controller_socket.settimeout(2)
            response = controller_socket.recv(1024).decode('utf-8')
            
            # Przetwórz dane telemetryczne z odpowiedzi
            process_telemetry_data(response)
            
            if "OK" in response or "PING" in response or "CONNECTED" in response:
                return True
            else:
                # Zwróć true nawet jeśli odpowiedź jest nieoczekiwana - obsłuż wszystkie możliwe odpowiedzi
                return True
            
        except Exception as e:
            # Użyj krótszego komunikatu błędu, aby nie zaśmiecać logów
            # print(f"Błąd wysyłania: {type(e).__name__}")
            # W przypadku błędu, oznacz połączenie jako utracone tylko dla poważnych błędów
            if isinstance(e, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError)):
                is_connected = False
            return False

def send_joystick_values(values: Dict[str, float]) -> bool:
    """
    Synchroniczna wersja do użycia w API. Aktualizuje timestamp ostatniej aktualizacji
    z frontendu i przekazuje wartości do wysłania.
    """
    global last_frontend_update
    
    # Zaktualizuj timestamp ostatniej aktualizacji z frontendu
    last_frontend_update = time.time()
    
    # Zapisz wartości w connection_manager dla innych komponentów
    connection_manager.update_joystick_values(values)
    
    try:
        # Sprawdź, czy jesteśmy w kontekście asynchronicznym
        loop = asyncio.get_running_loop()
        # Wywołaj asynchroniczną funkcję, ale nie czekaj na wynik
        # Zwróć True, zakładając że wysyłanie pójdzie dobrze (będzie obsługiwane w tle)
        asyncio.create_task(send_gamepad_values_async(values, connection_manager.get_button_values()))
        return True
    except RuntimeError:
        # Nie jesteśmy w kontekście asynchronicznym, używamy prostszego podejścia
        # Zwróć true, faktyczne wysyłanie będzie obsługiwane przez periodic_gamepad_update
        return True

def send_gamepad_data(data: GamepadData) -> bool:
    """
    Obsługuje pełne dane kontrolera (joystick i przyciski).
    Aktualizuje timestamp ostatniej aktualizacji z frontendu i przekazuje wartości do wysłania.
    """
    global last_frontend_update
    
    # Zaktualizuj timestamp ostatniej aktualizacji z frontendu
    last_frontend_update = time.time()
    
    # Zapisz wartości w connection_manager dla innych komponentów
    connection_manager.update_joystick_values(data.joystick.dict())
    connection_manager.update_button_values(data.buttons.dict())
    
    try:
        # Sprawdź, czy jesteśmy w kontekście asynchronicznym
        loop = asyncio.get_running_loop()
        # Wywołaj asynchroniczną funkcję, ale nie czekaj na wynik
        asyncio.create_task(send_gamepad_values_async(data.joystick.dict(), data.buttons.dict()))
        return True
    except RuntimeError:
        # Nie jesteśmy w kontekście asynchronicznym, używamy prostszego podejścia
        # Zwróć true, faktyczne wysyłanie będzie obsługiwane przez periodic_gamepad_update
        return True

def is_controller_connected() -> bool:
    """
    Sprawdza, czy połączenie z kontrolerem jest aktywne.
    
    Returns:
        bool: True jeśli połączenie jest aktywne, False w przeciwnym razie
    """
    global is_connected
    return is_connected

async def update_connection_status():
    """
    Aktualizuje status połączenia i wysyła go do klientów WebSocket
    """
    last_status = None
    
    while True:
        try:
            current_status = is_controller_connected()
            
            # Wysyłaj status tylko gdy się zmieni lub co 10 sekund
            if current_status != last_status or int(time.time()) % 10 == 0:
                status = {
                    "type": "connection_status",
                    "connected": current_status,
                    "timestamp": time.time()
                }
                
                # Informuj wszystkich klientów o statusie połączenia
                await connection_manager.broadcast_json(status)
                last_status = current_status
        except Exception as e:
            print(f"Błąd aktualizacji statusu połączenia: {e}")
        
        # Aktualizuj co 2 sekundy
        await asyncio.sleep(2)