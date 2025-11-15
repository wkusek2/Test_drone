#!/usr/bin/env python3
"""
Skrypt do uruchamiania backendu (main.py) oraz server.py (sterowanie dronem) 
i frontendu React dla projektu SubSeaBot.
Pozwala na zatrzymanie wszystkich procesów po naciśnięciu klawisza 'q'.
"""

import subprocess
import threading
import os
import time
import sys
import signal
import termios
import tty
import psutil

# Konfiguracja ścieżek do katalogów projektu
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_PATH = os.path.join(PROJECT_ROOT, "backend")  # Katalog z main.py
SERVER_PATH = os.path.join(PROJECT_ROOT, "server")    # Katalog z server.py
FRONTEND_PATH = os.path.join(PROJECT_ROOT, "frontend/src")  # Katalog z frontendem React

# Pomocnicze zmienne dla procesów
processes = []
stop_threads = False
logs_lock = threading.Lock()

def get_pressed_key():
    """
    Funkcja do odczytywania pojedynczego znaku z klawiatury bez czekania na Enter.
    Zwraca naciśnięty klawisz.
    """
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setraw(sys.stdin.fileno())
        ch = sys.stdin.read(1)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
    return ch

def print_colored(text, color_code):
    """
    Wyświetla kolorowy tekst w terminalu.
    Kody kolorów:
    - 91: czerwony
    - 92: zielony
    - 93: żółty
    - 94: niebieski
    - 95: magenta
    - 96: cyjan
    """
    print(f"\033[{color_code}m{text}\033[0m")

def run_backend():
    """
    Uruchamia backend (main.py) i monitoruje jego wyjście.
    """
    global stop_threads
    
    print_colored("Uruchamianie backendu (main.py)...", 94)
    
    # Przejdź do katalogu z backendem
    os.chdir(BACKEND_PATH)
    
    # Uruchom main.py z uvicorn
    try:
        backend_process = subprocess.Popen(
            ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            preexec_fn=os.setsid  # Umożliwia wysłanie sygnału do grupy procesów
        )
        processes.append(backend_process)
        
        print_colored("Backend uruchomiony.", 92)
        
        # Monitoruj wyjście z backendu
        while not stop_threads:
            line = backend_process.stdout.readline()
            if not line and backend_process.poll() is not None:
                break
            # if line:
            #     with logs_lock:
                    
            #         print_colored(f"[BACKEND] {line.strip()}", 96)
        
        # Jeśli pętla została przerwana, sprawdź, czy proces nadal działa
        if backend_process.poll() is None:
            os.killpg(os.getpgid(backend_process.pid), signal.SIGTERM)
            print_colored("Backend zatrzymany.", 93)
    
    except Exception as e:
        print_colored(f"Błąd podczas uruchamiania backendu: {e}", 91)

def run_server():
    """
    Uruchamia server.py (sterowanie dronem) i monitoruje jego wyjście.
    """
    global stop_threads
    
    print_colored("Uruchamianie server.py (sterowanie dronem)...", 94)
    
    # Odczekaj chwilę przed uruchomieniem
    time.sleep(1)
    
    # Przejdź do katalogu z server.py
    os.chdir(SERVER_PATH)
    
    # Uruchom server.py
    try:
        server_process = subprocess.Popen(
            ["python3", "server.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            preexec_fn=os.setsid  # Umożliwia wysłanie sygnału do grupy procesów
        )
        processes.append(server_process)
        
        print_colored("Server.py uruchomiony.", 92)
        
        # Monitoruj wyjście z server.py
        while not stop_threads:
            line = server_process.stdout.readline()
            if not line and server_process.poll() is not None:
                break
            if line:
                with logs_lock:
                    print_colored(f"[SERVER] {line.strip()}", 94)
        
        # Jeśli pętla została przerwana, sprawdź, czy proces nadal działa
        if server_process.poll() is None:
            os.killpg(os.getpgid(server_process.pid), signal.SIGTERM)
            print_colored("Server.py zatrzymany.", 93)
    
    except Exception as e:
        print_colored(f"Błąd podczas uruchamiania server.py: {e}", 91)

def run_frontend():
    """
    Uruchamia frontend React i monitoruje jego wyjście.
    """
    global stop_threads
    
    print_colored("Uruchamianie frontendu (React)...", 94)
    
    # Odczekaj chwilę, aby backend mógł się uruchomić
    time.sleep(3)
    
    # Przejdź do katalogu z frontendem
    os.chdir(FRONTEND_PATH)
    
    # Uruchom npm start
    try:
        frontend_process = subprocess.Popen(
            ["npm", "start"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env={
                **os.environ,
                "HOST": "0.0.0.0",  # Pozwala na dostęp z innych urządzeń w sieci
                "BROWSER": "none"   # Nie otwiera przeglądarki automatycznie
            },
            preexec_fn=os.setsid  # Umożliwia wysłanie sygnału do grupy procesów
        )
        processes.append(frontend_process)
        
        print_colored("Frontend uruchomiony.", 92)
        
        # Monitoruj wyjście z frontendu
        while not stop_threads:
            line = frontend_process.stdout.readline()
            if not line and frontend_process.poll() is not None:
                break
            if line:
                with logs_lock:
                    print_colored(f"[FRONTEND] {line.strip()}", 95)
        
        # Jeśli pętla została przerwana, sprawdź, czy proces nadal działa
        if frontend_process.poll() is None:
            os.killpg(os.getpgid(frontend_process.pid), signal.SIGTERM)
            print_colored("Frontend zatrzymany.", 93)
    
    except Exception as e:
        print_colored(f"Błąd podczas uruchamiania frontendu: {e}", 91)

def key_listener():
    """
    Nasłuchuje klawiszy naciśniętych przez użytkownika.
    Kończy wszystkie procesy po naciśnięciu 'q'.
    """
    global stop_threads
    
    print_colored("Naciśnij 'q', aby zakończyć wszystkie procesy i wyjść.", 93)
    
    while not stop_threads:
        key = get_pressed_key()
        if key.lower() == 'q':
            print_colored("\nZakończenie działania na żądanie użytkownika...", 93)
            stop_threads = True
            cleanup()
            break
        time.sleep(0.1)

def cleanup():
    """
    Zatrzymuje wszystkie uruchomione procesy.
    """
    print_colored("Zatrzymywanie wszystkich procesów...", 93)
    
    # Zatrzymaj każdy proces
    for process in processes:
        try:
            if process.poll() is None:  # Jeśli proces nadal działa
                pgrp = os.getpgid(process.pid)
                os.killpg(pgrp, signal.SIGTERM)
                print_colored(f"Proces {process.pid} zatrzymany.", 93)
        except (ProcessLookupError, PermissionError) as e:
            print_colored(f"Nie można zatrzymać procesu {process.pid}: {e}", 91)
    
    # Dodatkowe czyszczenie - zabijamy wszystkie procesy npm, node i python, które mogły zostać
    try:
        for proc in psutil.process_iter(['pid', 'name']):
            if any(name in proc.info['name'] for name in ['node', 'npm', 'python']):
                try:
                    # Sprawdź, czy proces jest związany z naszym projektem
                    cmdline = " ".join(proc.cmdline()).lower()
                    if any(path.lower() in cmdline for path in [BACKEND_PATH.lower(), FRONTEND_PATH.lower(), SERVER_PATH.lower()]):
                        print_colored(f"Zatrzymywanie pozostałego procesu: {proc.info['name']} (PID: {proc.info['pid']})", 93)
                        os.kill(proc.info['pid'], signal.SIGTERM)
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    pass
    except Exception as e:
        print_colored(f"Błąd podczas czyszczenia pozostałych procesów: {e}", 91)
    
    print_colored("Wszystkie procesy zakończone.", 92)

def main():
    """
    Główna funkcja programu.
    """
    global stop_threads
    
    try:
        print_colored("=== SubSeaBot Launcher ===", 92)
        print_colored("Uruchamianie systemu SubSeaBot...", 94)
        
        # Uruchom backend w osobnym wątku
        backend_thread = threading.Thread(target=run_backend, daemon=True)
        backend_thread.start()
        
        # Uruchom server.py w osobnym wątku
        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
        
        # Krótkie opóźnienie przed uruchomieniem frontendu
        time.sleep(5)
        
        # Uruchom frontend w osobnym wątku
        frontend_thread = threading.Thread(target=run_frontend, daemon=True)
        frontend_thread.start()
        
        # Uruchom nasłuchiwanie klawiszy w głównym wątku
        key_listener()
        
        # Czekaj na zakończenie wątków
        backend_thread.join(timeout=5)
        server_thread.join(timeout=5)
        frontend_thread.join(timeout=5)
        
    except KeyboardInterrupt:
        print_colored("\nPrzerwano przez użytkownika (Ctrl+C)", 93)
    except Exception as e:
        print_colored(f"Nieoczekiwany błąd: {e}", 91)
    finally:
        stop_threads = True
        cleanup()

if __name__ == "__main__":
    main()