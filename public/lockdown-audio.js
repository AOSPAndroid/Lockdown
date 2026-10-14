/** Lockdown's sound: short synthesized tones and noise bursts, no audio files. */
export class GameAudio {
  constructor() { this.context = null; this.master = null; this.enabled = false; }
  async setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) { await this.context?.suspend(); return; }
    if (!this.context) {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) throw new Error('Web Audio is unavailable.');
      this.context = new Context(); this.master = this.context.createGain(); this.master.gain.value = .7; this.master.connect(this.context.destination);
    }
    await this.context.resume();
  }
  tone(frequency, duration, { type = 'sine', end = frequency, gain = .3, delay = 0 } = {}) {
    if (!this.enabled || this.context?.state !== 'running') return;
    const start = this.context.currentTime + delay, oscillator = this.context.createOscillator(), envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end), start + duration);
    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0001, gain), start + .006);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(envelope); envelope.connect(this.master);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(start); oscillator.stop(start + duration + .02);
  }
  noise(duration, { highpass = 500, lowpass = 6000, gain = .2, delay = 0 } = {}) {
    if (!this.enabled || this.context?.state !== 'running') return;
    const start = this.context.currentTime + delay, length = Math.max(1, Math.ceil(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource(); source.buffer = buffer;
    const high = this.context.createBiquadFilter(); high.type = 'highpass'; high.frequency.value = highpass;
    const low = this.context.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = lowpass;
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0001, gain), start + .004);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    source.connect(high); high.connect(low); low.connect(envelope); envelope.connect(this.master);
    source.onended = () => { source.disconnect(); high.disconnect(); low.disconnect(); envelope.disconnect(); };
    source.start(start); source.stop(start + duration + .02);
  }
  fight() { this.tone(220, .21, { end: 440, type: 'triangle', gain: .35 }); this.tone(660, .25, { delay: .07, gain: .25 }); this.noise(.18, { highpass: 700, gain: .18 }); }
}
