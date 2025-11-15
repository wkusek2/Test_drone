import os
import socket
import threading
import sys
import psutil
import time
import re
import subprocess
import serial
import json
import math
import numpy as np
global dpad_up, dpad_down, dpad_left, dpad_right
global przycisk_trojka, przycisk_x, btn_square, btn_circle

#================================================================================================
# Vehicle dimensions
VEHICLE_WIDTH, VEHICLE_HEIGHT = 100, 150

# Thruster positions and orientations (T1, T2, T3, T4, T5, T6, T7)
angle_rad = math.radians(115)
thrusters = [
    (-VEHICLE_WIDTH/2, -VEHICLE_HEIGHT/2, math.cos(angle_rad), math.sin(angle_rad)),  # T1
    (VEHICLE_WIDTH/2, -VEHICLE_HEIGHT/2, -math.cos(angle_rad), math.sin(angle_rad)), # T2
    (VEHICLE_WIDTH/2, VEHICLE_HEIGHT/2, -math.cos(angle_rad), -math.sin(angle_rad)),  # T3
    (-VEHICLE_WIDTH/2, VEHICLE_HEIGHT/2, math.cos(angle_rad), -math.sin(angle_rad)), # T4
    (-VEHICLE_WIDTH/2, 0, 1, 0),  # T5 (central, left side, roll control)
    (VEHICLE_WIDTH/2, 0, -1, 0),  # T6 (central, right side, roll control)
    (0, -VEHICLE_HEIGHT/2, 0, 1),  # T7 (central, rear, pitch control)
]

global immersion_input
x, y, rotation = 0, 0, 0
    
# Zmienne do płynnej zmiany rolla i pitcha (dla stopniowych zmian)
roll_input = 0
pitch_input = 0
roll_target = 0  # Celowy roll (do kontrolowania stopniowego wzrostu)
pitch_target = 0  # Celowy pitch (do kontrolowania stopniowego wzrostu)
roll_smoothness = 0.01  # Czynnik płynności dla rolla
pitch_smoothness = 0.01  # Czynnik płynności dla pitcha
    
# Dodajemy zmienne do płynnej zmiany zanurzenia/emergencji
immersion_input = 0
immersion_smoothness = 0.01  # Wartość, która określa szybkość zmiany zanurzenia/emergencji
immersion_target = 0


# D-pad (hat)
dpad_up = False
dpad_down= False
dpad_left = False
dpad_right = False
# Face buttons
przycisk_trojka = False  # PS: Triangle, Xbox: Y
przycisk_x = False     # PS: Cross/X, Xbox: A
btn_square = False    # PS: Square, Xbox: X
btn_circle = False    # PS: Circle, Xbox: B

#================================================================================================

# Zmienne globalne do przechowywania wartości joysticków
j1 = 0
j2 = 0
j3 = 0
j4 = 0

# Zmienne do przechowywania danych systemowych
cpu_usage = 0.0
cpu_temp = 0.0
last_stats_update = time.time()

# Zmienne do przechowywania danych z MPU6050
mpu_data = {
    "accel_x": 0.0,
    "accel_y": 0.0, 
    "accel_z": 0.0,
    "gyro_x": 0.0,
    "gyro_y": 0.0,
    "gyro_z": 0.0,
    "temp": 0.0,
    "timestamp": time.time()
}
mpu_data_lock = threading.Lock()

# Inicjalizacja połączenia UART z Pico
try:
    ser = serial.Serial('/dev/ttyACM0', 115200, timeout=1)  # Dostosuj port do swojego systemu
    print("Połączenie UART z Pico zostało pomyślnie nawiązane.")
except Exception as e:
    print(f"Błąd podczas otwierania portu UART: {e}")
    ser = None

def check_CPU_temp():
    temp = None
    err, msg = subprocess.getstatusoutput('vcgencmd measure_temp')
    if not err:
        m = re.search(r'-?\d\.?\d*', msg)
        try:
            temp = float(m.group())
        except ValueError:
            pass
    return temp, msg

def collect_system_stats():
    global cpu_usage, cpu_temp, last_stats_update
    
    # Aktualizuj co sekundę
    current_time = time.time()
    if current_time - last_stats_update < 1.0:
        return
    
    # Pobierz użycie CPU
    cpu_usage = psutil.cpu_percent()
    
    # Pobierz temperaturę CPU
    temp, _ = check_CPU_temp()
    if temp is not None:
        cpu_temp = temp
    
    # Zaktualizuj czas ostatniej aktualizacji
    last_stats_update = current_time

def process_mpu_data(data_str):
    """Przetwarza dane z MPU6050 otrzymane przez UART."""
    global mpu_data
    
    try:
        # Format: MPU:AccelX,AccelY,AccelZ,GyroX,GyroY,GyroZ,Temp
        parts = data_str[4:].split(',')  # Usunięcie "MPU:" i podział po przecinkach
        
        if len(parts) == 7:
            with mpu_data_lock:
                mpu_data = {
                    "accel_x": float(parts[0]),
                    "accel_y": float(parts[1]),
                    "accel_z": float(parts[2]),
                    "gyro_x": float(parts[3]),
                    "gyro_y": float(parts[4]),
                    "gyro_z": float(parts[5]),
                    "temp": float(parts[6]),
                    "timestamp": time.time()
                }
            
            # Zapisz dane do pliku log
            log_data = mpu_data.copy()
            log_data["timestamp_str"] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(log_data["timestamp"]))
            
            with open("mpu_data.log", "a") as log_file:
                log_file.write(json.dumps(log_data) + "\n")
                
            # print(f"MPU Data: Accel[X:{parts[0]}, Y:{parts[1]}, Z:{parts[2]}], " +
            #       f"Gyro[X:{parts[3]}, Y:{parts[4]}, Z:{parts[5]}], Temp:{parts[6]}")
            
            # Wyślij dane do backendu
            try:
                send_mpu_data_to_backend(mpu_data)
            except Exception as e:
                print(f"Błąd podczas wysyłania danych do backendu: {e}")
    
    except Exception as e:
        print(f"Błąd podczas przetwarzania danych MPU: {e}")

def send_mpu_data_to_backend(data):
    """Wysyła dane MPU do backendu przez HTTP."""
    try:
        import requests
        backend_url = "http://192.168.100.25:8000/api/mpu-data"
        response = requests.post(backend_url, json=data, timeout=3)
        
        if response.status_code == 200:
            # print("Dane MPU wysłane do backendu pomyślnie")
            pass
        else:
            print(f"Błąd wysyłania danych do backendu: {response.status_code}")
    except Exception as e:
        print(f"Wyjątek podczas wysyłania danych do backendu: {e}")

def request_mpu_data():
    """Wysyła żądanie danych z MPU6050 do Pico."""
    if ser:
        try:
            ser.write(b"GET_MPU_DATA\n")
        except Exception as e:
            print(f"Błąd podczas wysyłania żądania danych MPU: {e}")

def receive_from_pico():
    buffer = ""
    while True:
        if ser and ser.in_waiting > 0:
            try:
                # Odczytaj jeden znak na raz
                char = ser.read(1).decode('utf-8')
                
                # Dodaj znak do bufora
                buffer += char
                
                # Sprawdź, czy znak to nowa linia (koniec wiadomości)
                if char == '\n':
                    # Usuń znak nowej linii i przetwórz kompletną wiadomość
                    message = buffer.strip()
                    buffer = ""
                    
                    # Przetwarzanie różnych typów wiadomości
                    if message.startswith("MPU:"):
                        process_mpu_data(message)
                    elif message.startswith("MOTORS_SET:"):
                        i = 0
                        # print(f"Ustawienia silników: {message[11:]}")
                    elif message.startswith("ERROR:"):
                        print(f"Błąd z Pico: {message[6:]}")
                    elif message.startswith("MPU_ERROR:"):
                        print(f"Błąd MPU6050: {message[10:]}")
                    elif message.startswith("MPU_OK:"):
                        print(f"Status MPU6050: {message[7:]}")
                    elif message.startswith("SYSTEM_READY:"):
                        print(f"System gotowy: {message[13:]}")
                    elif message.startswith("MOTORS_INIT:"):
                        print(f"Inicjalizacja silników: {message[12:]}")
                    elif message.startswith("MOTORS_READY:"):
                        print(f"Silniki gotowe: {message[13:]}")
                    elif message == "PONG":
                        # print("Otrzymano odpowiedź PONG od Pico")
                        pass
                    else:
                        print(f"Odpowiedź od Pico: {message}")
            except Exception as e:
                print(f"Błąd podczas odczytu danych z Pico: {e}")
                buffer = ""  # Zresetuj bufor w przypadku błędu
                time.sleep(1)  # Daj czas na ponowną inicjalizację
        else:
            time.sleep(1)  # Krótka pauza aby nie obciążać CPU


pwm_values_global = [1480, 1480, 1480, 1480, 1480, 1480, 1480]  # Neutral values for all thrusters







def send_to_pico():
    global pwm_values_global
    while True:
        if ser:
            # Use the global PWM values set by the control() function
            pulse1, pulse2, pulse3, pulse4, pulse5, pulse6, pulse7 = pwm_values_global
            
            # Przygotuj ramkę
            frame = f"<{pulse7},{pulse3},{pulse2},{pulse6},{pulse5},{pulse4},{pulse1}>\n"
            # frame = f"<{pulse1},{pulse2},{pulse3},{pulse4},{pulse5},{pulse6},{pulse7}>\n"
            
            # Wyślij ramkę do Pico
            try:
                ser.write(frame.encode('utf-8'))
            except Exception as e:
                print(f"Błąd podczas wysyłania danych do Pico: {e}")
        time.sleep(0.01)  # Czekaj 50 ms przed kolejnym wysłaniem
        
        
def inverse_kinematics(j1, j2, rotation, roll, pitch):
    # Control for T1, T2, T3, T4 (forward/backward, left/right, rotation)
    thruster_values = [
        v[3] * j1 + v[2] * j2 + ((v[0] * v[3] - v[1] * v[2]) * rotation * 2) / (VEHICLE_WIDTH + VEHICLE_HEIGHT)
        for v in thrusters[:4]
    ]
    # Adding T5, T6, and T7 contributions for roll and pitch control
    thruster_values.append(roll)    # T5 (roll to left)
    thruster_values.append(-roll)   # T6 (roll to right)
    thruster_values.append(pitch)   # T7 (pitch control)
    
    max_val = max(abs(val) for val in thruster_values)
    return [val / max_val if max_val > 1 else val for val in thruster_values]

def control():
    global pwm_values_global
    global roll_input, pitch_input, immersion_input
    global roll_target, pitch_target, immersion_target
    global dpad_up, dpad_down, dpad_left, dpad_right
    global przycisk_trojka, przycisk_x
    
    last_button_state = None
    
    while True:
        # Create a current state tuple to detect changes
        current_button_state = (dpad_up, dpad_down, dpad_left, dpad_right, przycisk_trojka, przycisk_x)
        
        # Only print when button states change to avoid console spam
        if current_button_state != last_button_state:
            # print(f"BUTTONS CHANGED! D-pad: Up={dpad_up}, Down={dpad_down}, Left={dpad_left}, Right={dpad_right}, "
            #       f"Triangle={przycisk_trojka}, X={przycisk_x}")
            last_button_state = current_button_state
             
        # Kontrola rolla za pomocą D-Pada
        if dpad_left:  # D-Pad Left (roll)
            roll_target = -1  # Negatywny dla lewego rolla
            print("Roll left activated")
        elif dpad_right:  # D-Pad Right (roll)
            roll_target = 1   # Pozytywny dla prawego rolla
            print("Roll right activated")
        else:
            roll_target = 0  # Resetowanie celu rolla, jeśli nie wciśnięto przycisku

        # Kontrola pitcha za pomocą D-Pada
        if dpad_up:  # D-Pad Up (pitch)
            pitch_target = 1   # Pozytywny dla pitcha w górę
            print("Pitch up activated")
        elif dpad_down:  # D-Pad Down (pitch)
            pitch_target = -1  # Negatywny dla pitcha w dół
            print("Pitch down activated")
        else:
            pitch_target = 0  # Resetowanie celu pitcha, jeśli nie wciśnięto przycisku

        # Kontrola zanurzenia/emergencji
        if przycisk_x:  # Button X (Immersion)
            print("X button pressed - Immersion activated")
            immersion_target = -1  # Zanurzenie (w dół)
        elif przycisk_trojka:  # Button Triangle (Emergence)
            print("Triangle button pressed - Emergence activated")
            immersion_target = 1   # Emergence (w górę)
        else:
            immersion_target = 0   # Brak zanurzenia/emergencji

        # Płynna interpolacja rolla
        if roll_target != 0:
            if roll_input < roll_target:
                roll_input += roll_smoothness
            elif roll_input > roll_target:
                roll_input -= roll_smoothness
        else:
            roll_input = 0  # Natychmiastowe resetowanie, gdy cel jest zerowy

        # Płynna interpolacja pitcha
        if pitch_target != 0:
            if pitch_input < pitch_target:
                pitch_input += pitch_smoothness
            elif pitch_input > pitch_target:
                pitch_input -= pitch_smoothness
        else:
            pitch_input = 0  # Natychmiastowe resetowanie, gdy cel jest zerowy

        # Płynna interpolacja zanurzenia/emergencji
        if immersion_target != 0:
            if immersion_input < immersion_target:
                immersion_input += immersion_smoothness
            elif immersion_input > immersion_target:
                immersion_input -= immersion_smoothness
        else:
            immersion_input = 0  # Natychmiastowe resetowanie, gdy cel jest zerowy

        # Zastosowanie zanurzenia/emergencji do wartości silników T5, T6, T7
        immersion_value = immersion_input * 0.5  # Ustawienie siły zanurzenia/emergencji

        # Pobieranie wartości silników
        thruster_values = inverse_kinematics(j1, j2, j3, roll_input, pitch_input)

        # Dodanie zanurzenia/emergencji do T5, T6 i T7
        thruster_values[4] += immersion_value  # T5
        thruster_values[5] += immersion_value  # T6
        thruster_values[6] += immersion_value  # T7
        # print(thruster_values)
        # Konwersja -1...1 na PWM 1000...1960
        PWM_MIN = 1000  
        PWM_MAX = 1960
        pwm_values = [int((val + 1) / 2 * (PWM_MAX - PWM_MIN) + PWM_MIN) for val in thruster_values]
        # print(pwm_values)
        # Update the global PWM values that send_to_pico will use
        pwm_values_global = pwm_values
        
        # Add a sleep to control the update rate
        time.sleep(0.01)  # Update at 20Hz


global btn_l1, btn_r1, btn_l2, btn_r2, btn_select, btn_start

# D-pad (hat)
dpad_up = False
dpad_down = False
dpad_left = False
dpad_right = False

# Face buttons
przycisk_trojka = False  # PS: Triangle, Xbox: Y
przycisk_x = False       # PS: Cross/X, Xbox: A
btn_square = False       # PS: Square, Xbox: X
btn_circle = False       # PS: Circle, Xbox: B

# Shoulder buttons - these are missing in your original global declarations
btn_l1 = False
btn_r1 = False
btn_l2 = False
btn_r2 = False

# Other buttons - these are missing in your original global declarations
btn_select = False
btn_start = False


# Replace the button detection part in your receive_data function with this code:
def receive_data(client_socket):
    global j1, j2, j3, j4, dpad_up, dpad_down, dpad_left, dpad_right
    global przycisk_trojka, przycisk_x, btn_square, btn_circle
    global btn_l1, btn_r1, btn_l2, btn_r2, btn_select, btn_start
    
    client_socket.settimeout(0.1)
    client_connected = True
    
    while client_connected:
        try:
            # Odbieranie danych od klienta
            message = client_socket.recv(1024).decode('utf-8')
            if not message:
                break
            
            # Print raw message for debugging
            # print(f"Raw message: {message}")
            
            # Aktualizuj wartości joysticków
            try:
                # Dopasowanie do starego formatu: "joystick1: 50, joystick2: 50, joystick3: 50, joystick4: 50"
                j_matches = re.findall(r'joystick(\d+): (\d+)', message)
                for match in j_matches:
                    joystick_num = int(match[0])
                    joystick_value = int(match[1])
                    
                    if joystick_num == 1:
                        j1 = (joystick_value - 50)/50
                    elif joystick_num == 2:
                        j2 = (joystick_value - 50)/50
                    elif joystick_num == 3:
                        j3 = (joystick_value - 50)/50
                    elif joystick_num == 4:
                        j4 = (joystick_value - 50)/50
                
                # Reset all button states first
                dpad_up = dpad_down = dpad_left = dpad_right = False
                przycisk_trojka = przycisk_x = btn_square = btn_circle = False
                btn_l1 = btn_r1 = btn_l2 = btn_r2 = btn_select = btn_start = False
                
                # Based on your controller's format, we need to match HAT_UP:1 style messages
                # D-pad/HAT buttons - handle both possible formats
                if "HAT_UP:1" in message:
                    dpad_up = True
                    print("D-pad UP detected")
                if "HAT_DOWN:1" in message:
                    dpad_down = True
                    print("D-pad DOWN detected")
                if "HAT_LEFT:1" in message:
                    dpad_left = True
                    print("D-pad LEFT detected")
                if "HAT_RIGHT:1" in message:
                    dpad_right = True
                    print("D-pad RIGHT detected")
                
                # Alternative format - also check for traditional format
                if "dpad_up:1" in message:
                    dpad_up = True
                if "dpad_down:1" in message:
                    dpad_down = True
                if "dpad_left:1" in message:
                    dpad_left = True
                if "dpad_right:1" in message:
                    dpad_right = True
                
                # Check for action buttons - we need to find out the exact name in your messages
                # Try with BTN_TRIANGLE first
                if "BTN_TRIANGLE:1" in message:
                    przycisk_trojka = True
                    print("Triangle button detected")
                # Also try other possible names for the Triangle button
                if "BTN_TRI:1" in message or "przycisk_trojka:1" in message:
                    przycisk_trojka = True
                
                # Check for X button with various names
                if "BTN_X:1" in message:
                    przycisk_x = True
                    print("X button detected")
                # Check alternative names
                if "BTN_CROSS:1" in message or "przycisk_x:1" in message:
                    przycisk_x = True
                
                # Other buttons - square, circle
                if "BTN_SQUARE:1" in message or "BTN_SQ:1" in message:
                    btn_square = True
                    print("Square button detected")
                if "BTN_CIRCLE:1" in message or "BTN_CIRC:1" in message:
                    btn_circle = True
                    print("Circle button detected")
                
                # Shoulder buttons
                if "BTN_L1:1" in message:
                    btn_l1 = True
                if "BTN_R1:1" in message:
                    btn_r1 = True
                if "BTN_L2:1" in message:
                    btn_l2 = True
                if "BTN_R2:1" in message:
                    btn_r2 = True
                
                # Other buttons
                if "BTN_SELECT:1" in message or "BTN_SEL:1" in message:
                    btn_select = True
                if "BTN_START:1" in message:
                    btn_start = True
                    
                # Debug output for buttons
                button_states = {
                    "D-pad": f"Up:{dpad_up} Down:{dpad_down} Left:{dpad_left} Right:{dpad_right}",
                    "Face": f"Triangle:{przycisk_trojka} X:{przycisk_x} Square:{btn_square} Circle:{btn_circle}",
                    "Shoulder": f"L1:{btn_l1} R1:{btn_r1} L2:{btn_l2} R2:{btn_r2}",
                    "Other": f"Select:{btn_select} Start:{btn_start}"
                }
                # print("Button states after processing:")
                # for category, states in button_states.items():
                #     print(f"  {category}: {states}")
                    
            except (IndexError, ValueError) as e:
                print(f"Błąd w przetwarzaniu wiadomości od klienta: {e}")
            
            # Aktualizacja danych systemowych
            collect_system_stats()
            
            # Pobierz aktualne dane MPU6050
            mpu_data_copy = {}
            with mpu_data_lock:
                mpu_data_copy = mpu_data.copy()
            
            # Dodaj informacje o stanie przycisków do odpowiedzi
            button_info = ""
            if dpad_up or dpad_down or dpad_left or dpad_right:
                button_info += f"dpad_up:{int(dpad_up)},dpad_down:{int(dpad_down)},dpad_left:{int(dpad_left)},dpad_right:{int(dpad_right)},"
            if przycisk_trojka or przycisk_x or btn_square or btn_circle:
                button_info += f"BTN_TRI:{int(przycisk_trojka)},przycisk_x:{int(przycisk_x)},BTN_SQ:{int(btn_square)},BTN_CIRC:{int(btn_circle)},"
            if btn_l1 or btn_r1 or btn_l2 or btn_r2:
                button_info += f"BTN_L1:{int(btn_l1)},BTN_R1:{int(btn_r1)},BTN_L2:{int(btn_l2)},BTN_R2:{int(btn_r2)},"
            if btn_select or btn_start:
                button_info += f"BTN_SEL:{int(btn_select)},BTN_START:{int(btn_start)},"
            
            # Przygotuj odpowiedź z danymi telemetrycznymi, danymi MPU i stanem przycisków
            response = (f"CPU:{cpu_usage}%,TEMP:{cpu_temp}°C,J1:{j1},J2:{j2},J3:{j3},J4:{j4}," +
                f"ACCEL_X:{mpu_data_copy['accel_x']:.2f},ACCEL_Y:{mpu_data_copy['accel_y']:.2f}," +
                f"ACCEL_Z:{mpu_data_copy['accel_z']:.2f},GYRO_X:{mpu_data_copy['gyro_x']:.2f}," +
                f"GYRO_Y:{mpu_data_copy['gyro_y']:.2f},GYRO_Z:{mpu_data_copy['gyro_z']:.2f},")  # Dodanie napięcia baterii
            
            # Dodaj informacje o przyciskach, jeśli są aktywne
            if button_info:
                response += "," + button_info[:-1]  # Usuń ostatni przecinek
            
            # Wyślij dane telemetryczne do klienta
            try:
                client_socket.send(response.encode('utf-8'))
            except Exception as e:
                print(f"Błąd podczas wysyłania danych do klienta: {e}")
                client_connected = False
                break
                
        except socket.timeout:
            # Timeout jest normalny, kontynuuj
            # Zbierz dane systemowe
            collect_system_stats()
            
            # Żądanie aktualnych danych MPU6050
            request_mpu_data()
            
            # Pobierz aktualne dane MPU6050
            mpu_data_copy = {}
            with mpu_data_lock:
                mpu_data_copy = mpu_data.copy()
            
            # Przygotuj informację o stanie przycisków
            button_info = ""
            if dpad_up or dpad_down or dpad_left or dpad_right:
                button_info += f"dpad_up:{int(dpad_up)},dpad_down:{int(dpad_down)},dpad_left:{int(dpad_left)},dpad_right:{int(dpad_right)},"
            if przycisk_trojka or przycisk_x or btn_square or btn_circle:
                button_info += f"BTN_TRI:{int(przycisk_trojka)},przycisk_x:{int(przycisk_x)},BTN_SQ:{int(btn_square)},BTN_CIRC:{int(btn_circle)},"
            if btn_l1 or btn_r1 or btn_l2 or btn_r2:
                button_info += f"BTN_L1:{int(btn_l1)},BTN_R1:{int(btn_r1)},BTN_L2:{int(btn_l2)},BTN_R2:{int(btn_r2)},"
            if btn_select or btn_start:
                button_info += f"BTN_SEL:{int(btn_select)},BTN_START:{int(btn_start)},"
            
            # Co jakiś czas wysyłaj aktualne dane systemowe i MPU
            try:
                # Przygotuj odpowiedź z danymi telemetrycznymi
                telemetry = (f"TELEMETRY|CPU:{cpu_usage}%,TEMP:{cpu_temp}°C,J1:{j1},J2:{j2},J3:{j3},J4:{j4}," +
                 f"ACCEL_X:{mpu_data_copy['accel_x']:.2f},ACCEL_Y:{mpu_data_copy['accel_y']:.2f}," +
                 f"ACCEL_Z:{mpu_data_copy['accel_z']:.2f},GYRO_X:{mpu_data_copy['gyro_x']:.2f}," +
                 f"GYRO_Y:{mpu_data_copy['gyro_y']:.2f},GYRO_Z:{mpu_data_copy['gyro_z']:.2f},")  # Dodanie napięcia baterii
                
                # Dodaj informacje o przyciskach, jeśli są aktywne
                if button_info:
                    telemetry += "," + button_info[:-1]  # Usuń ostatni przecinek
                    
                client_socket.send(telemetry.encode('utf-8'))
            except Exception as e:
                print(f"Błąd podczas wysyłania telemetrii: {e}")
                client_connected = False
                break
                
        except (ConnectionResetError, BrokenPipeError) as e:
            print(f"Połączenie z klientem zostało przerwane: {e}")
            client_connected = False
            break
        except Exception as e:
            print(f"Nieoczekiwany błąd: {e}")
            client_connected = False
            break

    print("Klient rozłączony")
    try:
        client_socket.close()
    except:
        pass

def handle_client(client_socket):
    threading.Thread(target=receive_data, args=(client_socket,)).start()

def start_server():
    global server
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    
    # Opcje socketu dla lepszego ponownego użycia adresu
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    server.bind(('0.0.0.0', 9998))
    server.listen(5)
    print("Serwer nasłuchuje na porcie 9998...")
    
    while True:
        try:
            client_socket, addr = server.accept()
            print(f"Połączono z {addr}")
            client_handler = threading.Thread(target=handle_client, args=(client_socket,))
            client_handler.daemon = True  # Wątek będzie zamknięty przy zakończeniu programu
            client_handler.start()
        except Exception as e:
            print(f"Błąd podczas akceptowania połączenia: {e}")
            time.sleep(1)  # Odczekaj chwilę przed ponowną próbą

def execute_commands():
    os.system("./mediamtx > /dev/null 2>&1 &")

def stop_server():
    os.system("pkill mediamtx")
    try:
        server.close()
    except:
        pass
    print("Zakończono proces mediamtx i zwolniono port 9998")
    sys.exit(0)

def ping_pico():
    """Wątek okresowo wysyłający ping do Pico, aby upewnić się, że połączenie jest aktywne."""
    while True:
        if ser:
            try:
                ser.write(b"PING\n")
                # Nie czekamy na odpowiedź tutaj, bo jest obsługiwana w wątku receive_from_pico
            except Exception as e:
                print(f"Błąd podczas pingowania Pico: {e}")
        time.sleep(30)  # Ping co 30 sekund

# Zastąpienie funkcji do tworzenia okna prostym menu konsolowym


            
def console_menu():
    print("\n=== Menu Kontroli Serwera ===")
    print("Naciśnij Ctrl+C aby zatrzymać serwer")
    print("Dane z MPU6050 są zapisywane do pliku mpu_data.log")
    
    try:
        while True:
            # Pobierz dane z MPU
            with mpu_data_lock:
                mpu_data_copy = mpu_data.copy()
                
            # Wyświetlaj okresowo status serwera i dane MPU
            print(f"\nStatus: CPU: {cpu_usage:.1f}%, Temp: {cpu_temp:.1f}°C")
            print(f"Joysticki: J1={j1}, J2={j2}, J3={j3}, J4={j4}")
            print(f"MPU6050: Accel[X:{mpu_data_copy['accel_x']:.2f}, " +
                  f"Y:{mpu_data_copy['accel_y']:.2f}, Z:{mpu_data_copy['accel_z']:.2f}], " +
                  f"Gyro[X:{mpu_data_copy['gyro_x']:.2f}, Y:{mpu_data_copy['gyro_y']:.2f}, " +
                  f"Z:{mpu_data_copy['gyro_z']:.2f}], Temp:{mpu_data_copy['temp']:.1f}°C")
            
            # Oblicz orientację w przestrzeni (prymitywny filtr)
            roll = round(180 * ((mpu_data_copy['accel_y']) / 9.81) / 3.14159, 1)
            pitch = round(180 * (-(mpu_data_copy['accel_x']) / 9.81) / 3.14159, 1)
            
            print(f"Orientacja: Roll (przechył)={roll}°, Pitch (pochylenie)={pitch}°")
            time.sleep(5)
    except KeyboardInterrupt:
        stop_server()

if __name__ == "__main__":
    # Uruchom wątki monitorowania systemu
    threading.Thread(target=collect_system_stats, daemon=True).start()
    
    # Uruchom wątki komunikacji
    threading.Thread(target=send_to_pico, daemon=True).start()
    threading.Thread(target=execute_commands, daemon=True).start()
    threading.Thread(target=start_server, daemon=True).start()
    threading.Thread(target=control, daemon=True).start()
    threading.Thread(target=receive_from_pico, daemon=True).start()
    threading.Thread(target=ping_pico, daemon=True).start()
    
    # Uruchom menu konsolowe (główny wątek)
    console_menu()