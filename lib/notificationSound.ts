let audioCtx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

/**
 * Play a short, pleasant two-tone notification chime using Web Audio API.
 * No external audio files needed.
 */
export function playNotificationSound() {
  try {
    const ctx = getContext();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;

    // Two-tone chime: C5 → E5
    const freqs = [523.25, 659.25];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.3);
    });
  } catch {
    // Silently fail - audio not critical
  }
}
