class SoundEngine {
  private ctx: AudioContext | null = null;
  private soundEnabled = true;
  private musicEnabled = false;
  private musicInterval: number | null = null;
  private noteStep = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (enabled) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.12,
    delay = 0
  ) {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playClick() {
    this.playTone(540, 0.06, 'triangle', 0.07);
  }

  public playDiceRoll() {
    if (!this.soundEnabled) return;
    const clicks = [260, 340, 290, 410, 320, 460];
    clicks.forEach((f, idx) => {
      this.playTone(f, 0.045, 'square', 0.045, idx * 0.055);
    });
  }

  public playHop(step = 0) {
    const base = 360 + (step % 6) * 35;
    this.playTone(base, 0.085, 'sine', 0.1);
  }

  public playSafe() {
    this.playTone(660, 0.14, 'triangle', 0.1, 0);
    this.playTone(880, 0.18, 'triangle', 0.09, 0.08);
  }

  public playCapture() {
    this.playTone(220, 0.16, 'sawtooth', 0.11, 0);
    this.playTone(140, 0.24, 'triangle', 0.13, 0.08);
  }

  public playHomeFinish() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => this.playTone(n, 0.18, 'triangle', 0.1, idx * 0.07));
  }

  public playVictory() {
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const delays = [0, 0.1, 0.2, 0.32, 0.48, 0.62];
    fanfare.forEach((n, i) => this.playTone(n, 0.32, 'triangle', 0.13, delays[i]));
  }

  public startMusic() {
    if (typeof window === 'undefined' || !this.musicEnabled) return;
    if (this.musicInterval !== null) return;

    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 440.0, 392.0];
    this.musicInterval = window.setInterval(() => {
      if (!this.musicEnabled) return;
      const ctx = this.ensureContext();
      if (!ctx || ctx.state !== 'running') return;

      const freq = scale[this.noteStep % scale.length];
      this.noteStep += 1;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.032, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.75);
    }, 680);
  }

  public stopMusic() {
    if (this.musicInterval !== null) {
      window.clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

export const soundEngine = new SoundEngine();
