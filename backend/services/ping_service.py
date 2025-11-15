import asyncio
import platform
import socket
import time
import subprocess
from typing import Dict, Any

async def check_host_availability(host: str, timeout: int = 5) -> Dict[str, Any]:
    """
    Sprawdza dostępność hosta używając różnych metod: ICMP (ping) i TCP.
    
    Args:
        host: Adres IP lub nazwa hosta do sprawdzenia
        timeout: Maksymalny czas oczekiwania w sekundach
        
    Returns:
        Dict zawierający status i czas odpowiedzi
    """
    # Wyczyść adres hosta z możliwych dodatkowych elementów
    if host.startswith("http://"):
        host = host[7:]
    elif host.startswith("https://"):
        host = host[8:]
    
    # Usuń port i ścieżkę jeśli istnieją
    host = host.split("/")[0].split(":")[0]
    
    # Najpierw spróbuj standardowego pingu (ICMP) dla najbardziej wiarygodnych wyników
    ping_result = await ping_host(host, timeout)
    if ping_result["success"]:
        return ping_result
    
    # Jeśli ping się nie powiedzie, spróbuj połączenia TCP
    tcp_result = await check_host_tcp(host, timeout)
    if tcp_result["success"]:
        return tcp_result
    
    # Jeśli wszystkie metody zawiodły, zwróć błąd
    return {
        "success": False, 
        "error": "Host unreachable", 
        "host": host
    }

async def ping_host(host: str, timeout: int = 5) -> Dict[str, Any]:
    """
    Wykonuje standardowy ping (ICMP) do hosta
    
    Args:
        host: Adres IP lub nazwa hosta do pingowania
        timeout: Maksymalny czas oczekiwania w sekundach
        
    Returns:
        Dict zawierający status i czas odpowiedzi
    """
    system = platform.system().lower()
    
    # Parametry ping zależne od systemu operacyjnego
    if system == "windows":
        ping_cmd = ["ping", "-n", "1", "-w", str(timeout * 1000), host]
    else:  # Linux/Mac
        ping_cmd = ["ping", "-c", "1", "-W", str(timeout), host]
    
    try:
        start_time = time.time()
        process = await asyncio.create_subprocess_exec(
            *ping_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        end_time = time.time()
        
        # Czas wykonania komendy ping
        elapsed_time = (end_time - start_time) * 1000  # ms
        
        # Sprawdź wynik pingu
        output = stdout.decode()
        
        # Analiza wyników w zależności od systemu
        if system == "windows":
            if "TTL=" in output:
                # Spróbuj wyodrębnić czas z odpowiedzi Windows
                try:
                    time_str = output.split("time=")[1].split("ms")[0].strip()
                    ping_time = float(time_str)
                except (IndexError, ValueError):
                    ping_time = elapsed_time
                
                return {
                    "success": True,
                    "time_ms": round(ping_time, 2),
                    "host": host,
                    "method": "icmp_ping"
                }
        else:  # Linux/Mac
            if " 0% packet loss" in output:
                # Spróbuj wyodrębnić czas z odpowiedzi Linux/Mac
                try:
                    time_str = output.split("time=")[1].split(" ms")[0].strip()
                    ping_time = float(time_str)
                except (IndexError, ValueError):
                    ping_time = elapsed_time
                
                return {
                    "success": True,
                    "time_ms": round(ping_time, 2),
                    "host": host,
                    "method": "icmp_ping"
                }
        
        # Jeśli ping się nie powiódł
        return {
            "success": False,
            "error": "ICMP ping failed",
            "host": host
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Ping error: {str(e)}",
            "host": host
        }

async def check_host_tcp(host: str, timeout: int = 5) -> Dict[str, Any]:
    """
    Sprawdza dostępność hosta używając TCP zamiast ICMP.
    
    Args:
        host: Adres IP lub nazwa hosta do pingowania
        timeout: Maksymalny czas oczekiwania w sekundach
        
    Returns:
        Dict zawierający status i czas odpowiedzi
    """
    # Lista portów do sprawdzenia w kolejności
    common_ports = [80, 443, 22, 8080, 8443]
    
    for port in common_ports:
        try:
            start_time = time.time()
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port), 
                timeout=timeout
            )
            
            # Zamknij połączenie jeśli się udało
            writer.close()
            await writer.wait_closed()
            
            # Oblicz czas odpowiedzi
            response_time = (time.time() - start_time) * 1000  # konwersja na ms
            
            return {
                "success": True, 
                "time_ms": round(response_time, 2),
                "host": host,
                "method": f"tcp_{port}"
            }
        except (asyncio.TimeoutError, ConnectionRefusedError, socket.gaierror):
            # Próbuj następny port
            continue
    
    # Jeśli wszystkie porty zawiodły
    return {
        "success": False,
        "error": "TCP connection failed on all ports",
        "host": host
    }