// NIGHTJAR — sound. One clear job: every sound is synthesized with the
// Web Audio API, so the game ships no audio files. Footsteps tell the
// player where a guard is; the alert sting, coin clink and pickup chime
// mark the stealth beats. Silent until the first user gesture.
let ctx = null;
let master = null;
let ambient = null;

function ensure() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch {
    return null;
  }
  return ctx;
}

/** Start the low night hum. Call after the first gesture. */
export function startAmbient() {
  if (!ensure() || ambient) return;
  try {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    lfo.start();
    ambient = { osc, lfo };
  } catch { /* audio is garnish, never fatal */ }
}

function tone(freq, dur, type, vol, when = 0, slideTo = null) {
  if (!ensure()) return;
  try {
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch { /* ignore */ }
}

function noiseBurst(dur, vol, freq, when = 0) {
  if (!ensure()) return;
  try {
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
  } catch { /* ignore */ }
}

/** A soft footstep; `loud` for a sprint step, `pan` -1..1 for direction. */
export function playStep(loud, pan = 0) {
  if (!ensure()) return;
  try {
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.07);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = loud ? 900 : 420;
    const g = ctx.createGain();
    g.gain.value = loud ? 0.22 : 0.08;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      src.connect(filter); filter.connect(g); g.connect(panner); panner.connect(master);
    } else {
      src.connect(filter); filter.connect(g); g.connect(master);
    }
    src.start(t0);
  } catch { /* ignore */ }
}

/** Guard footstep from a direction: the tell that something is near. */
export function playGuardStep(pan, dist) {
  const vol = Math.max(0.02, 0.16 * (1 - dist / 420));
  if (!ensure() || vol <= 0.02) return;
  playStep(false, pan);
}

export function playCoin() { tone(1568, 0.09, 'sine', 0.16); tone(2093, 0.14, 'sine', 0.12, 0.05); }
export function playClink() { tone(2400, 0.06, 'triangle', 0.2); tone(1800, 0.1, 'triangle', 0.12, 0.04); }
export function playPickup() { tone(880, 0.1, 'sine', 0.16); tone(1318, 0.16, 'sine', 0.14, 0.07); }
export function playRelic() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'sine', 0.15, i * 0.08)); }
export function playSuspicious() { tone(392, 0.18, 'triangle', 0.16, 0, 330); }
export function playAlarm() { tone(220, 0.5, 'sawtooth', 0.14, 0, 440); tone(220, 0.5, 'sawtooth', 0.14, 0.28, 440); }
export function playCaught() { tone(196, 0.7, 'sawtooth', 0.18, 0, 98); noiseBurst(0.3, 0.2, 500); }
export function playEscape() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.25, 'triangle', 0.14, i * 0.09)); }
export function playSmoke() { noiseBurst(0.5, 0.25, 1200); }
export function playTripwire() { tone(1200, 0.12, 'square', 0.1); tone(1200, 0.12, 'square', 0.1, 0.16); }

/** Resume the audio context after a user gesture (autoplay policy). */
export function resumeAudio() {
  if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  startAmbient();
}
