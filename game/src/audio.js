// All sound is synthesised with WebAudio: no audio files, no network. The context
// is created lazily on the first user gesture (browsers block audio before one),
// and every effect is a short oscillator or noise burst with an envelope.
export function createAudio() {
  let context = null;
  let muted = false;
  let master = null;

  function ensure() {
    if (context) return context;
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.22;
    master.connect(context.destination);
    return context;
  }

  /** Resume (or create) the context from a user gesture. Call on start/restart. */
  function unlock() {
    const ctx = ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  function tone(freq, seconds, type, volume, when = 0, slideTo = null) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    const start = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), start + seconds);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  }

  function noise(seconds, volume, when = 0, lowpass = 1200) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    const start = ctx.currentTime + when;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    /** A soft rising chirp for a jump; higher when it is the double jump. */
    jump(double) {
      tone(double ? 520 : 420, 0.16, 'sine', 0.5, 0, double ? 880 : 700);
    },
    /** A quick whoosh for diving down. */
    dive() {
      noise(0.18, 0.35, 0, 900);
    },
    /** A chime that climbs with the combo, so a streak sounds like a streak. */
    pickup(combo) {
      const base = 660 + Math.min(combo, 8) * 55;
      tone(base, 0.14, 'sine', 0.5);
      tone(base * 1.5, 0.2, 'sine', 0.35, 0.05);
    },
    /** A dull thud plus a falling tone when Pip is hit. */
    hit() {
      noise(0.22, 0.6, 0, 500);
      tone(220, 0.3, 'sawtooth', 0.3, 0, 70);
    },
    /** A warm major arpeggio when the shield petal is caught. */
    shield() {
      [523, 659, 784].forEach((freq, i) => tone(freq, 0.22, 'triangle', 0.4, i * 0.07));
    },
    /** A bright rising arpeggio for reaching dawn. */
    win() {
      [523, 659, 784, 1047, 1319].forEach((freq, i) => tone(freq, 0.4, 'triangle', 0.45, i * 0.11));
    },
    /** Three slow descending notes for game over. */
    over() {
      [392, 311, 233].forEach((freq, i) => tone(freq, 0.5, 'triangle', 0.4, i * 0.22));
    },
    /** A short tick when the level (and the speed) steps up. */
    level() {
      tone(880, 0.1, 'square', 0.18);
      tone(1175, 0.14, 'square', 0.18, 0.09);
    },
  };
}
