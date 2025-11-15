# Plik: src/backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio

from models import Item
from routes import items_router, system_router, joystick_router, ping_router, websocket_router, mpu_router, voltage_router
from services.socket_service import initialize_socket

# Inicjalizacja aplikacji FastAPI
app = FastAPI()

# Konfiguracja CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dołączanie routerów
app.include_router(items_router)
app.include_router(system_router)
app.include_router(joystick_router)
app.include_router(ping_router)
app.include_router(websocket_router)
app.include_router(mpu_router)  # Router dla MPU6050
app.include_router(voltage_router)  # Router dla danych napięcia

# Inicjalizacja połączenia socketowego przy starcie aplikacji
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(initialize_socket())

# Uruchomienie serwera:
# python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload