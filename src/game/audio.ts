import { SettingsConfig } from './types';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audioCtx = new Ctx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function triggerHaptic(settings: SettingsConfig, durationMs = 12): void {
  if (!settings.hapticsEnabled) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(durationMs);
    }
  } catch {
    // Ignore unsupported vibration environments
  }
}

export type SoundEffectType = 'click' | 'connect' | 'disconnect' | 'place' | 'save' | 'error';

export function playSynthSfx(type: SoundEffectType, settings: SettingsConfig): void {
  if (settings.muted) return;
  const gainLevel = (settings.masterVolume / 100) * (settings.sfxVolume / 100);
  if (gainLevel <= 0.01) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  const pitchJitter = 1 + (Math.random() - 0.5) * 0.06;

  if (type === 'click') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520 * pitchJitter, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.045);
    gain.gain.setValueAtTime(0.14 * gainLevel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === 'connect') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440 * pitchJitter, now);
    osc.frequency.exponentialRampToValueAtTime(880 * pitchJitter, now + 0.09);
    gain.gain.setValueAtTime(0.2 * gainLevel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.11);
    triggerHaptic(settings, 16);
  } else if (type === 'disconnect') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(360 * pitchJitter, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.08);
    gain.gain.setValueAtTime(0.14 * gainLevel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.start(now);
    osc.stop(now + 0.095);
    triggerHaptic(settings, 10);
  } else if (type === 'place') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180 * pitchJitter, now);
    osc.frequency.exponentialRampToValueAtTime(340 * pitchJitter, now + 0.08);
    gain.gain.setValueAtTime(0.24 * gainLevel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.start(now);
    osc.stop(now + 0.1);
    triggerHaptic(settings, 20);
  } else if (type === 'save') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880, now + 0.06);
    gain.gain.setValueAtTime(0.18 * gainLevel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.19);
  } else if (type === 'error') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.setValueAtTime(120, now + 0.06);
    gain.gain.setValueAtTime(0.18 * gainLevel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.start(now);
    osc.stop(now + 0.15);
    triggerHaptic(settings, 25);
  }
}
