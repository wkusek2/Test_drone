import React, { useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketManager';

// Style dla komponentu
const styles = {
  container: {
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    padding: '12px',
    margin: '8px 0',
    color: 'white',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    maxWidth: '100%',
    marginTop: '-15px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  title: {
    fontSize: '16px',
    fontWeight: 'bold',
    margin: '-4px'
  },
  statusIndicator: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#4CAF50'
  },
  dataSection: {
    marginBottom: '16px'
  },
  dataTitle: {
    fontSize: '14px',
    color: '#a0aec0',
    marginBottom: '8px'
  },
  dataGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px'
  },
  dataItem: {
    backgroundColor: '#2d3748',
    padding: '10px',
    borderRadius: '6px',
    textAlign: 'center'
  },
  dataLabel: {
    fontSize: '12px',
    color: '#a0aec0',
    marginBottom: '4px'
  },
  dataValue: {
    fontSize: '16px',
    fontWeight: 'bold'
  },
  orientationSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  gaugesContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    alignItems: 'center',
    marginTop: '0px'
  },
  gaugeItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '0px',
    width: '100%'
  },
  gaugeContainer: {
    width: '120px',
    height: '120px',
    position: 'relative',
    border: '2px solid #3182ce',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '-2px 0',
    backgroundColor: 'rgba(49, 130, 206, 0.1)'
  },
  gauge: {
    width: '120px',
    height: '120px',
    position: 'relative'
  },
  gaugeIndicator: {
    position: 'absolute',
    width: '3px',
    height: '50%',
    backgroundColor: 'white',
    bottom: '50%',
    left: 'calc(50% - 1.5px)',
    transformOrigin: 'bottom center',
    zIndex: 10
  },
  gaugeCenterDot: {
    width: '10px',
    height: '10px',
    backgroundColor: 'white',
    borderRadius: '50%',
    position: 'absolute',
    top: 'calc(50% - 5px)',
    left: 'calc(50% - 5px)'
  },
  gaugeFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%'
  },
  gaugeMarkings: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%'
  },
  gaugeMark: {
    position: 'absolute',
    width: '1.5px',
    height: '6px',
    backgroundColor: 'rgba(17, 231, 255, 0.3)',
    transformOrigin: 'center bottom',
    bottom: '50%',
    left: 'calc(50% - 0.75px)'
  },
  gaugeMarkMajor: {
    height: '10px',
    width: '2px',
    backgroundColor: 'rgba(255, 255, 255, 0.6)'
  },
  gaugeLabel: {
    position: 'absolute',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '10px',
    textAlign: 'center',
    width: '30px',
    marginLeft: '-15px'
  },
  gaugeValue: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginTop: '6px'
  },
  resetButton: {
    marginTop: '10px',
    padding: '8px 16px',
    backgroundColor: '#3182ce',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'background-color 0.2s'
  },
  resetButtonHover: {
    backgroundColor: '#2c5282'
  },
  buttonsContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    marginTop: '10px'
  },
  accelResetButton: {
    marginTop: '10px',
    padding: '8px 16px',
    backgroundColor: '#805ad5', // Fioletowy dla odróżnienia
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'background-color 0.2s'
  },
  accelResetButtonHover: {
    backgroundColor: '#6b46c1'
  },
  lastUpdate: {
    fontSize: '12px',
    color: '#a0aec0',
    textAlign: 'right',
    marginTop: '10px'
  }
};

// Funkcja pomocnicza do normalizacji kąta w zakresie 0-360
const normalizeAngle = (angle) => {
  if (typeof angle !== 'number') return 0;
  // Normalizacja do zakresu 0-360
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
};

const MPUOrientationDisplay = () => {
  const { mpuData, orientation, sendMessage } = useWebSocket();
  const [offsetValues, setOffsetValues] = useState({ roll: 0, pitch: 0 });
  const [accelOffsets, setAccelOffsets] = useState({ x: 0, y: 0, z: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isHoveringAccel, setIsHoveringAccel] = useState(false);
  
  // Renderowanie znaczników na zegarze
  const renderGaugeMarkings = (gaugeId) => {
    const marks = [];
    // Tworzymy 36 znaczników (co 10 stopni)
    for (let i = 0; i < 36; i++) {
      const rotation = i * 10;
      const isMajor = i % 9 === 0; // Co 90 stopni większy znacznik
      
      marks.push(
        <div
          key={`mark-${gaugeId}-${i}`}
          style={{
            ...styles.gaugeMark,
            ...(isMajor ? styles.gaugeMarkMajor : {}),
            transform: `rotate(${rotation}deg) translateY(-55px)`
          }}
        />
      );
      
      // Dodajemy etykiety co 90 stopni
      if (isMajor) {
        const labelValue = i * 10;
        let labelText;
        
        if (labelValue === 0) labelText = "0°";
        else if (labelValue === 90) labelText = "90°";
        else if (labelValue === 180) labelText = "180°";
        else if (labelValue === 270) labelText = "270°";
        
        if (labelText) {
          let labelTop, labelLeft;
          
          // Pozycjonowanie etykiet
          if (labelValue === 0) {
            labelTop = '10px';
            labelLeft = '50%';
          } else if (labelValue === 90) {
            labelTop = '50%';
            labelLeft = 'calc(100% - 20px)';
          } else if (labelValue === 180) {
            labelTop = 'calc(100% - 20px)';
            labelLeft = '50%';
          } else if (labelValue === 270) {
            labelTop = '50%';
            labelLeft = '5px';
          }
          
          marks.push(
            <div
              key={`label-${gaugeId}-${i}`}
              style={{
                ...styles.gaugeLabel,
                top: labelTop,
                left: labelLeft
              }}
            >
              {labelText}
            </div>
          );
        }
      }
    }
    return marks;
  };
  
  // Formatowanie czasu ostatniej aktualizacji
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Nieznany';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString();
  };

  // Określenie kolorów dla wartości w zależności od ich intensywności
  const getAccelerationColor = (value) => {
    const absValue = Math.abs(value);
    if (absValue < 0.5) return '#4CAF50'; // Zielony dla niskich wartości
    if (absValue < 5.0) return '#FFC107'; // Żółty dla średnich
    return '#F44336'; // Czerwony dla wysokich
  };

  const getGyroColor = (value) => {
    const absValue = Math.abs(value);
    if (absValue < 0.1) return '#4CAF50'; // Zielony dla niskich wartości
    if (absValue < 1.0) return '#FFC107'; // Żółty dla średnich
    return '#F44336'; // Czerwony dla wysokich
  };
  
  // Korekta wartości kąta z uwzględnieniem offsetu
  const getCorrectedAngle = (angle, offsetType) => {
    if (typeof angle !== 'number') return 0;
    // Obliczamy różnicę między aktualnym kątem a offsetem
    const corrected = angle - offsetValues[offsetType];
    // Normalizujemy kąt
    return normalizeAngle(corrected);
  };
  
  // Funkcja zwracająca skorygowaną wartość akcelerometru
  const getCorrectedAccel = (value, axis) => {
    if (typeof value !== 'number') return 0;
    return (value - accelOffsets[axis]).toFixed(2);
  };
  
  // Obsługa zerowania wartości orientacji
  const handleReset = () => {
    // Zapisujemy aktualne wartości jako offsety
    const currentOffsets = {
      roll: orientation.roll || 0,
      pitch: orientation.pitch || 0
    };
    setOffsetValues(currentOffsets);
    
    console.log("Ustawiono offsety orientacji:", currentOffsets);
    
    // Opcjonalnie - wysłanie informacji o zresetowaniu do serwera
    if (sendMessage) {
      sendMessage({
        type: 'reset_orientation',
        offsets: currentOffsets
      });
    }
  };
  
  // Obsługa zerowania wartości akcelerometru
  const handleResetAccel = () => {
    // Zapisujemy aktualne wartości akcelerometru jako offsety
    const currentAccelOffsets = {
      x: mpuData.accel_x || 0,
      y: mpuData.accel_y || 0,
      z: mpuData.accel_z || 0
    };
    setAccelOffsets(currentAccelOffsets);
    
    console.log("Ustawiono offsety akcelerometru:", currentAccelOffsets);
    
    // Opcjonalnie - wysłanie informacji o zresetowaniu do serwera
    if (sendMessage) {
      sendMessage({
        type: 'reset_accel',
        offsets: currentAccelOffsets
      });
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Czujnik MPU6050</h3>
        <div style={styles.statusIndicator}></div>
      </div>

      {/* Sekcja z danymi akcelerometru */}
      <div style={styles.dataSection}>
        <div style={styles.dataTitle}>Akcelerometr (m/s²)</div>
        <div style={styles.dataGrid}>
          <div style={styles.dataItem}>
            <div style={styles.dataLabel}>Oś X</div>
            <div 
              style={{
                ...styles.dataValue,
                color: getAccelerationColor(mpuData.accel_x)
              }}
            >
              {getCorrectedAccel(mpuData.accel_x, 'x')}
            </div>
          </div>
          <div style={styles.dataItem}>
            <div style={styles.dataLabel}>Oś Y</div>
            <div 
              style={{
                ...styles.dataValue,
                color: getAccelerationColor(mpuData.accel_y)
              }}
            >
              {getCorrectedAccel(mpuData.accel_y, 'y')}
            </div>
          </div>
          <div style={styles.dataItem}>
            <div style={styles.dataLabel}>Oś Z</div>
            <div 
              style={{
                ...styles.dataValue,
                color: getAccelerationColor(mpuData.accel_z)
              }}
            >
              {getCorrectedAccel(mpuData.accel_z, 'z')}
            </div>
          </div>
        </div>
      </div>

      {/* Sekcja z danymi żyroskopu */}
      <div style={styles.dataSection}>
        <div style={styles.dataTitle}>Żyroskop (stopnie/s)</div>
        <div style={styles.dataGrid}>
          <div style={styles.dataItem}>
            <div style={styles.dataLabel}>Oś X</div>
            <div 
              style={{
                ...styles.dataValue,
                color: getGyroColor(mpuData.gyro_x)
              }}
            >
              {mpuData.gyro_x.toFixed(3)}
            </div>
          </div>
          <div style={styles.dataItem}>
            <div style={styles.dataLabel}>Oś Y</div>
            <div 
              style={{
                ...styles.dataValue,
                color: getGyroColor(mpuData.gyro_y)
              }}
            >
              {mpuData.gyro_y.toFixed(3)}
            </div>
          </div>
          <div style={styles.dataItem}>
            <div style={styles.dataLabel}>Oś Z</div>
            <div 
              style={{
                ...styles.dataValue,
                color: getGyroColor(mpuData.gyro_z)
              }}
            >
              {mpuData.gyro_z.toFixed(3)}
            </div>
          </div>
        </div>
      </div>

      {/* Sekcja z orientacją w przestrzeni - zegary */}
      <div style={styles.dataSection}>
        <div style={styles.dataTitle}>Orientacja w przestrzeni</div>
        <div style={styles.gaugesContainer}>
          {/* Przechył (Roll) */}
          <div style={styles.gaugeItem}>
            <div style={styles.dataLabel}>Przechył (Roll)</div>
            <div style={styles.gaugeContainer}>
              <div style={styles.gauge}>
                <div style={styles.gaugeMarkings}>
                  {renderGaugeMarkings('roll')}
                </div>
                <div 
                  style={{
                    ...styles.gaugeIndicator,
                    transform: `rotate(${getCorrectedAngle(orientation.roll || 0, 'roll')}deg)`
                  }}
                ></div>
                <div style={styles.gaugeCenterDot}></div>
              </div>
            </div>
            <div style={styles.gaugeValue}>
              {getCorrectedAngle(orientation.roll || 0, 'roll').toFixed(1)}°
            </div>
          </div>
          
          {/* Pochylenie (Pitch) */}
          <div style={styles.gaugeItem}>
            <div style={styles.dataLabel}>Pochylenie (Pitch)</div>
            <div style={styles.gaugeContainer}>
              <div style={styles.gauge}>
                <div style={styles.gaugeMarkings}>
                  {renderGaugeMarkings('pitch')}
                </div>
                <div 
                  style={{
                    ...styles.gaugeIndicator,
                    transform: `rotate(${getCorrectedAngle(orientation.pitch || 0, 'pitch')}deg)`
                  }}
                ></div>
                <div style={styles.gaugeCenterDot}></div>
              </div>
            </div>
            <div style={styles.gaugeValue}>
              {getCorrectedAngle(orientation.pitch || 0, 'pitch').toFixed(1)}°
            </div>
          </div>
        </div>
        
        {/* Przyciski zerowania */}
        <div style={styles.buttonsContainer}>
          <button 
            style={{
              ...styles.resetButton,
              ...(isHovering ? styles.resetButtonHover : {})
            }}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={handleReset}
          >
            Zeruj orientację
          </button>
          
          <button 
            style={{
              ...styles.accelResetButton,
              ...(isHoveringAccel ? styles.accelResetButtonHover : {})
            }}
            onMouseEnter={() => setIsHoveringAccel(true)}
            onMouseLeave={() => setIsHoveringAccel(false)}
            onClick={handleResetAccel}
          >
            Zeruj akcelerometr
          </button>
        </div>
      </div>

      {/* Temperatura i informacja o aktualizacji */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{...styles.dataItem, minWidth: '100px'}}>
          <div style={styles.dataLabel}>Temperatura</div>
          <div style={styles.dataValue}>{mpuData.temp.toFixed(1)}°C</div>
        </div>
        
        <div style={styles.lastUpdate}>
          Ostatnia aktualizacja: {formatTimestamp(mpuData.timestamp)}
        </div>
      </div>
    </div>
  );
};

export default MPUOrientationDisplay;