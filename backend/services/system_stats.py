import random
import time

def generate_system_stats():
    """
    Generuje symulowane statystyki systemowe.
    
    Returns:
        dict: Słownik z wartościami CPU, temperatury i timestamp
    """
    return {
        "cpu_usage": round(random.uniform(5, 95), 1),  # Losowe obciążenie CPU od 5% do 95%
        "temperature": round(random.uniform(35, 85), 1),  # Losowa temperatura od 35°C do 85°C
        "timestamp": time.time()
    }