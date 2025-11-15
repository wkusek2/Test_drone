import React, { useState, useEffect, useRef } from 'react';
import SystemMonitor from './SystemMonitor';
import { useWebSocket } from './WebSocketManager';
import './RightSidePanel.css';
import MPUOrientationDisplay from './MPUOrientationDisplay';
import VoltageDisplay from './VoltageDisplay';

const RightSidePanel = ({ 
  initialOpacity = 0.8, 
  backgroundColor = "#333333", 
  width = "300px",
  zIndex = 50,
  style = {},
  children,
  position = "right" // New prop to determine position (left or right)
}) => {
  const [opacity, setOpacity] = useState(initialOpacity);
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isVisible, setIsVisible] = useState(true); // New state for panel visibility
  const animationFrameIdRef = useRef(null);
  
  // Use WebSocket context
  const { connected: socketConnected, sendMessage, joystickValues: axes, buttonValues } = useWebSocket();
  
  // Effect for gamepad detection
  useEffect(() => {
    // Gamepad connection handler
    const handleGamepadConnected = (e) => {
      console.log(`Gamepad connected: ${e.gamepad.id}`);
      setGamepadConnected(true);
    };

    // Gamepad disconnection handler
    const handleGamepadDisconnected = (e) => {
      console.log(`Gamepad disconnected: ${e.gamepad.id}`);
      setGamepadConnected(false);
    };

    // Add listeners for gamepad connection/disconnection
    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    // Check if gamepad is already connected
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gamepad of gamepads) {
      if (gamepad) {
        setGamepadConnected(true);
        break;
      }
    }

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
    };
  }, []);

  // Gamepad state update and server communication effect
  useEffect(() => {
    const updateGamepadState = () => {
      // Get current gamepad state
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gamepad = gamepads[0]; // Use first gamepad
      
      if (gamepad) {
        // Update joystick values
        const newAxes = {
          leftX: parseFloat((gamepad.axes[0] * 1).toFixed(2)),
          leftY: parseFloat((gamepad.axes[1] * 1).toFixed(2)),
          rightX: parseFloat((gamepad.axes[2] * 1).toFixed(2)),
          rightY: parseFloat((gamepad.axes[3] * 1).toFixed(2))
        };
        
        // Map gamepad button indices to our named buttons
        // This mapping might need adjustments for different controller types
        const newButtons = {
          // D-pad (hat) - these need special handling per controller
          dpadUp: gamepad.buttons[12] ? gamepad.buttons[12].pressed : false,
          dpadDown: gamepad.buttons[13] ? gamepad.buttons[13].pressed : false,
          dpadLeft: gamepad.buttons[14] ? gamepad.buttons[14].pressed : false, 
          dpadRight: gamepad.buttons[15] ? gamepad.buttons[15].pressed : false,
          
          // Face buttons (based on Xbox controller layout)
          buttonTriangle: gamepad.buttons[3] ? gamepad.buttons[3].pressed : false, // Y on Xbox, Triangle on PS
          buttonCross: gamepad.buttons[0] ? gamepad.buttons[0].pressed : false,    // A on Xbox, Cross/X on PS
          buttonSquare: gamepad.buttons[2] ? gamepad.buttons[2].pressed : false,   // X on Xbox, Square on PS
          buttonCircle: gamepad.buttons[1] ? gamepad.buttons[1].pressed : false,   // B on Xbox, Circle on PS
          
          // Shoulder buttons
          l1: gamepad.buttons[4] ? gamepad.buttons[4].pressed : false,
          r1: gamepad.buttons[5] ? gamepad.buttons[5].pressed : false,
          l2: gamepad.buttons[6] ? gamepad.buttons[6].value > 0.1 : false, // Use value for triggers
          r2: gamepad.buttons[7] ? gamepad.buttons[7].value > 0.1 : false,
          
          // Other buttons
          select: gamepad.buttons[8] ? gamepad.buttons[8].pressed : false, // Back/Select
          start: gamepad.buttons[9] ? gamepad.buttons[9].pressed : false   // Start
        };
        
        // Extract raw button data for debugging and direct sending
        const rawButtonData = Array.from(gamepad.buttons).map(btn => ({
          pressed: btn.pressed,
          value: btn.value,
          touched: btn.touched
        }));
        
        // Send values to server via WebSocket
        if (socketConnected) {
          sendMessage({ 
            joystick: newAxes,
            buttons: newButtons,
            rawButtons: rawButtonData,
            gamepadInfo: {
              id: gamepad.id,
              mapping: gamepad.mapping,
              timestamp: gamepad.timestamp,
              buttonCount: gamepad.buttons.length,
              axesCount: gamepad.axes.length
            }
          });
          setErrorMessage(''); // Clear error if send successful
        } else {
          setErrorMessage('No WebSocket connection to server');
          
          // Try alternative REST API method
          try {
            fetch('http://localhost:8000/api/joystick', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                joystick: newAxes,
                buttons: newButtons,
                rawButtons: rawButtonData
              }),
            });
          } catch (error) {
            console.error('Error sending joystick values via REST:', error);
          }
        }
      }
      
      // Continue animation frame loop
      animationFrameIdRef.current = requestAnimationFrame(updateGamepadState);
    };
    
    // Start animation frame loop if gamepad connected
    if (gamepadConnected) {
      animationFrameIdRef.current = requestAnimationFrame(updateGamepadState);
    }
    
    // Cleanup animation frame on unmount or gamepad disconnect
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [gamepadConnected, socketConnected, sendMessage]);

  // Opacity slider handler
  const handleOpacityChange = (e) => {
    setOpacity(parseFloat(e.target.value));
  };
  
  // Function to map joystick value (-1 to 1) to slider value (0 to 100)
  const mapJoystickToSlider = (value) => {
    // Add deadzone
    const deadzone = 0.15;
    
    // Return center value if in deadzone
    if (Math.abs(value) < deadzone) {
      return 50;
    }
    
    // Normalize values outside deadzone
    const normalizedValue = value > 0 
      ? (value - deadzone) / (1 - deadzone)
      : (value + deadzone) / (1 - deadzone);
    
    // Map to 0-100 range
    return Math.round(((normalizedValue + 1) / 2) * 100);
  };
  
  // Toggle panel visibility
  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };
  
  // Panel position style (left or right)
  const positionStyle = position === "left" 
    ? { left: isVisible ? "0" : `-${width}` } 
    : { right: isVisible ? "0" : `-${width}` };
  
  // Toggle button position (opposite side of panel)
  const toggleButtonPosition = position === "left" 
    ? { left: isVisible ? width : "0" } 
    : { right: isVisible ? width : "0" };
  
  // Complete panel style
  const panelCustomStyle = {
    backgroundColor,
    width,
    opacity,
    zIndex,
    ...positionStyle,
    ...style
  };
  
  // Status class determination
  const gamepadStatusClass = gamepadConnected 
    ? 'right-side-panel-gamepad-status connected' 
    : 'right-side-panel-gamepad-status disconnected';
  
  const socketStatusClass = socketConnected
    ? 'right-side-panel-socket-status connected'
    : 'right-side-panel-socket-status disconnected';
  
  return (
    <>
      {/* Toggle button */}
      <button 
        className="side-panel-toggle-button"
        style={toggleButtonPosition}
        onClick={toggleVisibility}
      >
        {isVisible ? (position === "left" ? "◀" : "▶") : (position === "left" ? "▶" : "◀")}
      </button>
      
      {/* Side panel */}
      <div className="right-side-panel" style={panelCustomStyle}>
        <div className="right-side-panel-content">
          {children || (
            <div>
              <h2>Control Panel</h2>
              
              {/* WebSocket connection status */}
              <div className={socketStatusClass}>
                {socketConnected ? 'Connected to server' : 'No server connection'}
                {errorMessage && <div className="right-side-panel-error">{errorMessage}</div>}
              </div>
              
              {/* Gamepad connection status */}
              <div className={gamepadStatusClass}>
                {gamepadConnected ? 'Gamepad connected' : 'No gamepad connected'}
              </div>
              
              {/* Joystick sliders */}
              <div className="right-side-panel-joystick-container">
                <h3 className="right-side-panel-joystick-title">Left joystick</h3>
                <label className="right-side-panel-axis-label">X axis: {axes.leftX}</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={mapJoystickToSlider(axes.leftX)}
                  readOnly
                  className="right-side-panel-slider" 
                />
                
                <label className="right-side-panel-axis-label">Y axis: {axes.leftY}</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={mapJoystickToSlider(axes.leftY)}
                  readOnly
                  className="right-side-panel-slider" 
                />
                
                <h3 className="right-side-panel-joystick-title">Right joystick</h3>
                <label className="right-side-panel-axis-label">X axis: {axes.rightX}</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={mapJoystickToSlider(axes.rightX)}
                  readOnly
                  className="right-side-panel-slider" 
                />
                
                <label className="right-side-panel-axis-label">Y axis: {axes.rightY}</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={mapJoystickToSlider(axes.rightY)}
                  readOnly
                  className="right-side-panel-slider" 
                />
              </div>

              <VoltageDisplay />
            </div>
          )}
        </div>
        
        {/* Only render these components on the right side */}
        {position === "right" && (
          <>
            <SystemMonitor/>
            
          </>
        )}
        
        {/* Opacity control slider */}
        <div className="right-side-panel-opacity-control">
          <label className="right-side-panel-opacity-label">
            Panel transparency
          </label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={opacity}
            onChange={handleOpacityChange}
            className="right-side-panel-opacity-slider"
          />
        </div>
      </div>
    </>
  );
};

export default RightSidePanel;