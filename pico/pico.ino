#include <Servo.h>
#include <Adafruit_NeoPixel.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>

// Inicjalizacja MPU6050
Adafruit_MPU6050 mpu;

// Definiowanie pinów I2C dla Pico
#define SDA_PIN 4 // GPIO 4
#define SCL_PIN 5 // GPIO 5


// Obiekty Servo dla 7 silników
Servo esc1; // Silnik 1
Servo esc2; // Silnik 2
Servo esc3; // Silnik 3
Servo esc4; // Silnik 4
Servo esc5; // Silnik 5
Servo esc6; // Silnik 6
Servo esc7; // Silnik 7

// Zakresy PWM dla sterowania
const int minPulse = 1000;    // Minimalna wartość PWM
const int centerPulse = 1480; // Neutralna wartość PWM
const int maxPulse = 2000;    // Maksymalna wartość PWM

// Aktualne wartości PWM dla każdego silnika
int currentValues[7] = {centerPulse, centerPulse, centerPulse, centerPulse, centerPulse, centerPulse, centerPulse};

// Flaga do jednorazowego wykonania sekwencji inicjalizacyjnej
bool initialRun = true;

// Konfiguracja WS2812
#define LED_PIN 10
#define NUM_LEDS 12
Adafruit_NeoPixel strip = Adafruit_NeoPixel(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

// Zmienne dla MPU6050
unsigned long lastMpuUpdate = 0;
const long mpuUpdateInterval = 100; // Odczyt MPU co 100ms (10Hz)



void setup()
{
  // Inicjalizacja komunikacji szeregowej
  Serial.begin(115200);

  // Inicjalizacja WS2812
  strip.begin();
  for (int i = 0; i < NUM_LEDS; i++)
  {
    strip.setPixelColor(i, strip.Color(255, 0, 0)); // Ustawienie diod na czerwono podczas inicjalizacji
  }
  strip.show();


  // Inicjalizacja I2C dla MPU6050
  delay(100); // Krótkie opóźnienie dla stabilizacji I2C

  // Inicjalizacja MPU6050
  if (!mpu.begin())
  {
    Serial.println("MPU_ERROR:Nie znaleziono czujnika MPU6050");
    // Miganie czerwonym światłem aby zasygnalizować błąd
    for (int i = 0; i < 5; i++)
    {
      for (int j = 0; j < NUM_LEDS; j++)
      {
        strip.setPixelColor(j, strip.Color(255, 0, 0));
      }
      strip.show();
      delay(200);
      for (int j = 0; j < NUM_LEDS; j++)
      {
        strip.setPixelColor(j, strip.Color(0, 0, 0));
      }
      strip.show();
      delay(200);
    }
  }
  else
  {
    Serial.println("MPU_OK:MPU6050 zainicjalizowany");
    // Sygnalizacja poprawnej inicjalizacji (zmiana na zielony)
    for (int i = 0; i < NUM_LEDS; i++)
    {
      strip.setPixelColor(i, strip.Color(0, 255, 0));
    }
    strip.show();
  }

  // Konfiguracja MPU6050
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  // Przypisz piny sterujące do obiektów Servo
  esc1.attach(2);  // Pin dla silnika 1
  esc2.attach(3);  // Pin dla silnika 2
  esc3.attach(12); // Pin dla silnika 3
  esc4.attach(6);  // Pin dla silnika 4
  esc5.attach(7);  // Pin dla silnika 5
  esc6.attach(8);  // Pin dla silnika 6
  esc7.attach(13); // Pin dla silnika 7

  // Ustaw ESC na wartość neutralną
  esc1.writeMicroseconds(centerPulse);
  esc2.writeMicroseconds(centerPulse);
  esc3.writeMicroseconds(centerPulse);
  esc4.writeMicroseconds(centerPulse);
  esc5.writeMicroseconds(centerPulse);
  esc6.writeMicroseconds(centerPulse);
  esc7.writeMicroseconds(centerPulse);

  delay(5000); // Czekaj na uzbrojenie ESC

  // Zmiana diod na biały po pełnej inicjalizacji
  for (int i = 0; i < NUM_LEDS; i++)
  {
    strip.setPixelColor(i, strip.Color(255, 255, 255));
  }
  strip.show();

  Serial.println("SYSTEM_READY:Inicjalizacja zakończona");
}

// Funkcja do odczytu napięcia baterii

void loop()
{
  // Jednorazowa sekwencja inicjalizacyjna
  if (initialRun)
  {
    Serial.println("MOTORS_INIT:Rozpoczynam sekwencję inicjalizacyjną silników");

    initialRun = false;
    Serial.println("MOTORS_READY:Sekwencja inicjalizacyjna zakończona");
  }

  // Odczyt i wysłanie danych z MPU6050 co określony interwał
  unsigned long currentMillis = millis();
  if (currentMillis - lastMpuUpdate >= mpuUpdateInterval)
  {
    lastMpuUpdate = currentMillis;

    // Pobieranie danych z MPU6050
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    // Formatowanie i wysyłanie danych przez Serial
    // Format: MPU:AccelX,AccelY,AccelZ,GyroX,GyroY,GyroZ,Temp
    Serial.print("MPU:");
    Serial.print(a.acceleration.x);
    Serial.print(",");
    Serial.print(a.acceleration.y);
    Serial.print(",");
    Serial.print(a.acceleration.z);
    Serial.print(",");
    Serial.print(g.gyro.x);
    Serial.print(",");
    Serial.print(g.gyro.y);
    Serial.print(",");
    Serial.print(g.gyro.z);
    Serial.print(",");
    Serial.println(temp.temperature);
  }

  // Odczyt i wysłanie napięcia baterii co określony interwał
  

  // Sprawdź, czy są dane w buforze szeregowym
  if (Serial.available() > 0)
  {
    String input = Serial.readStringUntil('\n'); // Odczytaj dane do znaku nowej linii

    // Usuń białe znaki z początku i końca
    input.trim();

    // Sprawdź, czy to żądanie odczytu napięcia
    
    // Sprawdź, czy dane są w poprawnym formacie
    if (input.startsWith("<") && input.endsWith(">"))
    {
      input = input.substring(1, input.length() - 1); // Usuń znaki '<' i '>'

      // Podziel ciąg na 7 części według przecinków
      int values[7];
      int index = 0;
      int lastIndex = 0;
      for (int i = 0; i < input.length(); i++)
      {
        if (input[i] == ',' || i == input.length() - 1)
        {
          String part = input.substring(lastIndex, (i == input.length() - 1) ? i + 1 : i);
          values[index++] = part.toInt();
          lastIndex = i + 1;

          // Jeśli mamy więcej niż 7 wartości, przerwij
          if (index >= 7)
            break;
        }
      }

      // Ustawienie sygnałów PWM na silnikach
      if (index == 7)
      { // Upewnij się, że są dokładnie 7 wartości
        esc1.writeMicroseconds(constrain(values[0], minPulse, maxPulse));
        esc2.writeMicroseconds(constrain(values[1], minPulse, maxPulse));
        esc3.writeMicroseconds(constrain(values[2], minPulse, maxPulse));
        esc4.writeMicroseconds(constrain(values[3], minPulse, maxPulse));
        esc5.writeMicroseconds(constrain(values[4], minPulse, maxPulse));
        esc6.writeMicroseconds(constrain(values[5], minPulse, maxPulse));
        esc7.writeMicroseconds(constrain(values[6], minPulse, maxPulse));

        // Zapisz aktualne wartości
        for (int i = 0; i < 7; i++)
        {
          currentValues[i] = constrain(values[i], minPulse, maxPulse);
        }

        // Potwierdzenie
        Serial.print("MOTORS_SET:");
        for (int i = 0; i < 7; i++)
        {
          Serial.print(currentValues[i]);
          if (i < 6)
            Serial.print(",");
        }
        Serial.println();
      }
      else
      {
        Serial.println("ERROR:Niepoprawna liczba wartości");
      }
    }
    // Sprawdź, czy to nie jest specjalne żądanie
    else if (input == "GET_MPU_DATA")
    {
      // Wysyłamy dane natychmiast na żądanie
      sensors_event_t a, g, temp;
      mpu.getEvent(&a, &g, &temp);

      Serial.print("MPU:");
      Serial.print(a.acceleration.x);
      Serial.print(",");
      Serial.print(a.acceleration.y);
      Serial.print(",");
      Serial.print(a.acceleration.z);
      Serial.print(",");
      Serial.print(g.gyro.x);
      Serial.print(",");
      Serial.print(g.gyro.y);
      Serial.print(",");
      Serial.print(g.gyro.z);
      Serial.print(",");
      Serial.println(temp.temperature);
    }
    // Rozpoznaj ping
    else if (input.startsWith("PING"))
    {
      Serial.println("PONG");
    }
  }
}
