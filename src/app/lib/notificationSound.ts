// Notification Sound Utility
// Uses Web Audio API to generate notification sounds

class NotificationSoundService {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    // Initialize audio context on user interaction
    if (typeof window !== 'undefined') {
      this.enabled = localStorage.getItem('notification_sound_enabled') !== 'false';
    }
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  private playTone(frequency: number, duration: number, volume: number = 0.3): void {
    if (!this.enabled) return;

    try {
      const ctx = this.getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (err) {
      console.warn('Failed to play notification sound:', err);
    }
  }

  // Success notification (gentle chime)
  success(): void {
    this.playTone(800, 0.1, 0.2);
    setTimeout(() => this.playTone(1000, 0.15, 0.15), 100);
  }

  // Error notification (lower tone)
  error(): void {
    this.playTone(300, 0.2, 0.25);
  }

  // Info notification (single tone)
  info(): void {
    this.playTone(600, 0.15, 0.2);
  }

  // Warning notification (double beep)
  warning(): void {
    this.playTone(500, 0.1, 0.2);
    setTimeout(() => this.playTone(500, 0.1, 0.2), 150);
  }

  // New message notification (pleasant chime)
  message(): void {
    this.playTone(660, 0.08, 0.15);
    setTimeout(() => this.playTone(880, 0.12, 0.12), 80);
  }

  // Enable/disable sound
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    localStorage.setItem('notification_sound_enabled', String(enabled));
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Initialize audio context on user interaction (required by browsers)
  init(): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }
}

export const notificationSound = new NotificationSoundService();
