import time
import psutil
import re
import subprocess

cpu_usage = 0.0
cpu_temp = 0.0
last_stats_update = time.time()

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

    return cpu_usage, cpu_temp, last_stats_update