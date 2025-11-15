import React, { useMemo } from 'react';

const BackgroundEffects = ({ backgroundOpacity, styles = {} }) => {
  const backgroundStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    // Gradient tła dla lepszego efektu głębi oceanu
    background: styles.background?.color || 'linear-gradient(to bottom, #0d253f 0%, #1e293b 40%, #0a192f 100%)',
    zIndex: 99999,
    opacity: backgroundOpacity,
    transition: 'opacity 0.8s ease, visibility 0.8s ease', // Dłuższa i płynniejsza animacja
    pointerEvents: backgroundOpacity > 0 ? 'all' : 'none', // Blokuje interakcje tylko gdy widoczne
    visibility: backgroundOpacity > 0 ? 'visible' : 'hidden',
    overflow: 'hidden', // Aby elementy nie wychodziły poza tło
    ...(styles.background || {})
  };

  // Generowanie zwiększonej liczby bąbelków w różnych kolorach na tle
  const backgroundBubbles = useMemo(() => {
    const bubbleColors = [
      'rgba(0, 102, 204, 0.3)',    // Podstawowy niebieski
      'rgba(30, 144, 255, 0.2)',   // Dodgerblue
      'rgba(65, 105, 225, 0.25)',  // RoyalBlue
      'rgba(100, 149, 237, 0.2)',  // CornflowerBlue
      'rgba(0, 191, 255, 0.15)',   // DeepSkyBlue
      'rgba(135, 206, 250, 0.1)',  // LightSkyBlue
      'rgba(70, 130, 180, 0.2)',   // SteelBlue
      'rgba(25, 25, 112, 0.2)',    // MidnightBlue
      'rgba(0, 0, 139, 0.15)',     // DarkBlue
      'rgba(72, 61, 139, 0.2)'     // DarkSlateBlue
    ];
    
    const bubbles = [];
    const bubbleCount = 150; // Znacznie więcej bąbelków na tle
    
    for (let i = 0; i < bubbleCount; i++) {
      const size = Math.floor(Math.random() * 35) + 3; // Rozmiar od 3px do 38px (różne rozmiary)
      const left = Math.floor(Math.random() * 100); // Pozycja od 0% do 100% szerokości
      const delay = Math.random() * 8; // Opóźnienie od 0s do 8s (większa różnorodność)
      const duration = Math.random() * 12 + 10; // Czas trwania od 10s do 22s (różne czasy)
      const colorIndex = Math.floor(Math.random() * bubbleColors.length);
      
      bubbles.push(
        <div 
          key={`bg-bubble-${i}`}
          style={{
            position: 'absolute',
            bottom: `${Math.random() * -20}%`, // Startują poniżej ekranu
            left: `${left}%`,
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            backgroundColor: bubbleColors[colorIndex],
            animation: `floatBubble ${duration}s linear infinite`,
            animationDelay: `${delay}s`,
            opacity: Math.random() * 0.4 + 0.2, // Losowa przezroczystość dla lepszego efektu
            zIndex: 99990 + i % 10 // Więcej wartości Z dla lepszego efektu głębi
          }} 
        />
      );
    }
    
    return bubbles;
  }, []); // Pusta tablica zależności - efekty generowane tylko raz

  // Generowanie promieni światła (efekt światła przebijającego się przez wodę)
  const lightRays = useMemo(() => {
    const rays = [];
    const rayCount = 5; // Liczba promieni światła
    
    for (let i = 0; i < rayCount; i++) {
      const width = Math.random() * 10 + 5; // Szerokość promienia od 5% do 15%
      const left = Math.random() * 80 + 10; // Pozycja od 10% do 90% szerokości
      const delay = Math.random() * 5; // Opóźnienie od 0s do 5s
      const duration = Math.random() * 8 + 10; // Czas trwania od 10s do 18s
      
      rays.push(
        <div 
          key={`light-ray-${i}`}
          style={{
            position: 'absolute',
            top: '-10%', // Zaczyna się ponad ekranem
            left: `${left}%`,
            width: `${width}%`,
            height: '120%', // Wysoki promień, aby przechodził przez cały ekran
            background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0))',
            transform: 'rotate(15deg)', // Ukośny promień
            animation: `lightRayEffect ${duration}s ease-in-out infinite`,
            animationDelay: `${delay}s`,
            opacity: 0.5,
            zIndex: 99980 // Poniżej bąbelków
          }} 
        />
      );
    }
    
    return rays;
  }, []);

  // Generowanie fal wody (efekt falowania wody)
  const waterWaves = useMemo(() => {
    const waves = [];
    const waveCount = 3; // Liczba fal
    
    for (let i = 0; i < waveCount; i++) {
      waves.push(
        <div 
          key={`water-wave-${i}`}
          className="water-wave"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '200%',
            height: '100%',
            background: `radial-gradient(ellipse at center, 
              rgba(255,255,255,0) 0%,
              rgba(255,255,255,0.03) 40%, 
              rgba(255,255,255,0) 60%)`,
            opacity: 0.3,
            zIndex: 99985 - i,
            animation: `waterWave ${10 + i * 3}s linear infinite`,
            animationDelay: `${i * 2}s`,
            transform: 'translate(-25%, 0)',
            pointerEvents: 'none'
          }} 
        />
      );
    }
    
    return waves;
  }, []);

  // Generowanie efektu pływających cząsteczek (małe drobinki w wodzie)
  const waterParticles = useMemo(() => {
    const particles = [];
    const particleCount = 80; // Liczba cząsteczek
    
    for (let i = 0; i < particleCount; i++) {
      const size = Math.random() * 2 + 1; // Rozmiar od 1px do 3px
      const left = Math.random() * 100; // Pozycja od 0% do 100% szerokości
      const top = Math.random() * 100; // Pozycja od 0% do 100% wysokości
      const delay = Math.random() * 5; // Opóźnienie od 0s do 5s
      const duration = Math.random() * 15 + 20; // Czas trwania od 20s do 35s
      
      particles.push(
        <div 
          key={`water-particle-${i}`}
          style={{
            position: 'absolute',
            top: `${top}%`,
            left: `${left}%`,
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            borderRadius: '50%',
            animation: `floatParticle ${duration}s linear infinite`,
            animationDelay: `${delay}s`,
            opacity: Math.random() * 0.5 + 0.1,
            zIndex: 99982,
            boxShadow: '0 0 2px rgba(255, 255, 255, 0.5)'
          }} 
        />
      );
    }
    
    return particles;
  }, []);

  return (
    <div style={backgroundStyle}>
      {/* Promienie światła */}
      {lightRays}
      
      {/* Fale wody */}
      {waterWaves}
      
      {/* Drobinki wody */}
      {waterParticles}
      
      {/* Bąbelki w tle */}
      {backgroundBubbles}
    </div>
  );
};

export default BackgroundEffects;