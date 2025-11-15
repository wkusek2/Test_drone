import React from 'react';
import './IPForm.css';

const IPForm = ({ 
  inputUrl, 
  setInputUrl, 
  connecting, 
  connected, 
  isPinging, 
  isValidIpAddress, 
  handleConnect,
  styles = {} 
}) => {
  // Określenie stanu przycisku
  const isButtonDisabled = connecting || connected || isPinging;
  
  // Określenie tekstu przycisku zależnie od stanu
  const getButtonText = () => {
    if (isPinging) return 'Sprawdzanie...';
    if (connecting) return 'Łączenie...';
    if (connected) return 'Połączono';
    return 'Połącz';
  };

  // Obliczenie styli uwzględniających przekazane przez props
  const getFormStyle = {
    ...(styles.form || {})
  };
  
  const getInputStyle = {
    ...(styles.input || {})
  };
  
  const getButtonStyle = isButtonDisabled ? 
    { ...(styles.buttonDisabled || {}) } : 
    { ...(styles.button || {}) };

  // Debugowanie stanu przycisku
  console.log("IPForm state:", { 
    inputUrl, 
    connecting, 
    connected, 
    isPinging, 
    isValidInput: isValidIpAddress(inputUrl) 
  });

  return (
    <div className="ip-form" style={getFormStyle}>
      <div className="ip-form-container">
        <input
          type="text"
          className="ip-form-input"
          style={getInputStyle}
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder="Wprowadź adres IP (np. 192.168.1.46:8889/cam1) lub raspberry.pi"
          disabled={connecting || connected}
        />
        <button
          className={`ip-form-button ${isButtonDisabled ? 'disabled' : ''}`}
          style={getButtonStyle}
          onClick={() => {
            console.log("Button clicked");
            handleConnect();
          }}
          disabled={isButtonDisabled}
        >
          {getButtonText()}
        </button>
      </div>
    </div>
  );
};

export default IPForm;