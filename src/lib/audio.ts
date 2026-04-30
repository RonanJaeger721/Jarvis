export const playSound = (type: 'start' | 'complete' | 'process' | 'alert' | 'scan') => {
  try {
    const audio = new Audio(
      type === 'start' 
        ? 'https://assets.mixkit.co/sfx/preview/mixkit-futuristic-power-up-relay-2576.mp3'
        : type === 'process'
        ? 'https://assets.mixkit.co/sfx/preview/mixkit-sci-fi-confirmation-914.mp3'
        : type === 'scan'
        ? 'https://assets.mixkit.co/sfx/preview/mixkit-scifi-interface-robot-click-2555.mp3'
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
