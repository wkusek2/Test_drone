import React from 'react';

const ConnectionError = ({ inputUrl, onRetry, styles = {} }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.8)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      textAlign: 'center',
      zIndex: 101000,
      ...(styles.errorContainer || {})
    }}>
      <div style={{
        backgroundColor: styles.errorContainer?.backgroundColor || '#222',
        padding: '30px',
        borderRadius: '8px',
        maxWidth: '500px',
        width: '90%',
        backdropFilter: 'blur(8px)', // Efekt szkła dla okna błędu
        ...(styles.errorBox || {})
      }}>
        <h3 style={{ fontSize: '24px', marginBottom: '20px' }}>Błąd ładowania strony</h3>
        <p style={{ fontSize: '16px', marginBottom: '15px' }}>Wystąpił problem z załadowaniem strony:</p>
        <p style={{ 
          fontSize: '16px', 
          fontWeight: 'bold', 
          marginBottom: '20px',
          wordBreak: 'break-all'
        }}>{inputUrl}</p>
        <p style={{ fontSize: '16px', marginBottom: '10px' }}>Przyczyną może być:</p>
        <ul style={{ textAlign: 'left', marginBottom: '20px' }}>
          <li style={{ marginBottom: '5px' }}>Blokada iframe przez stronę docelową</li>
          <li style={{ marginBottom: '5px' }}>Problemy z certyfikatem SSL</li>
          <li style={{ marginBottom: '5px' }}>Niedostępność strony</li>
        </ul>
        <button 
          onClick={onRetry}
          style={{
            padding: '12px 24px',
            backgroundColor: styles.errorButton?.backgroundColor || '#f03',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            ...(styles.errorButton || {})
          }}
        >
          Spróbuj ponownie
        </button>
      </div>
    </div>
  );
};

export default ConnectionError;