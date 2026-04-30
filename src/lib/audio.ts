export const playSound = (type: 'start' | 'complete' | 'process' | 'alert' | 'scan') => {
  try {
    const audio = new Audio(
      type === 'start' 
        ? 'https://assets.mixkit.co/sfx/preview/mixkit-futuristic-robotic-voice-startup-2559.mp3'
        : type === 'process'
        ? 'https://assets.mixkit.co/sfx/preview/mixkit-digital-quick-scan-2575.mp3'
        : type === 'scan'
        ? 'https://assets.mixkit.co/sfx/preview/mixkit-sci-fi-click-900.mp3'
        : type === 'alert'
        ? 'https://assets.mixkit.co/sfx/preview/mixkit-sci-fi-failure-alert-815.mp3'
        : 'https://assets.mixkit.co/sfx/preview/mixkit-tech-break-pulse-2911.mp3'
    );
    audio.volume = type === 'scan' ? 0.15 : 0.4;
    audio.play().catch(e => console.log('Audio play blocked:', e));
  } catch (err) {
    console.error('Audio error:', err);
  }
};
