// Ears.
//
// Everything here runs on one AnalyserNode per frame: a level, an onset
// strength, a brightness, and a beat. No library — the whole thing is a
// spectral flux novelty curve plus a phase-locked loop, which is about a
// hundred lines and behaves better than a generic beat detector on a single
// noisy source like a room microphone.
//
// The one judgement it will not make for you is which tempo to dance on. A
// track that autocorrelates at 88 does so just as strongly at 175, and a
// dancer moving on 175 looks frantic. `tempo` reports what it found and
// `halfTime` says whether it folded the answer down.

const FFT = 2048;         // ~23 Hz per bin at 48 kHz: enough to resolve a kick

// The novelty curve is autocorrelated, so it MUST be uniformly sampled — a lag
// only maps to a tempo if every sample is the same distance apart. Animation
// frames are not: they jitter, drop, and throttle in a background tab. So flux
// is accumulated into fixed hops off the wall clock instead of one sample per
// frame, and the rate below is exact by construction.
const HOP = 1 / 60;           // seconds per novelty sample
const HOP_RATE = 1 / HOP;
const HISTORY = 720;          // 12 s of novelty
const MIN_BPM = 60, MAX_BPM = 180;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Ears {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.kind = null;            // 'mic' | 'file'

    this.spectrum = null;
    this.prevSpectrum = null;
    this.wave = null;

    this.level = 0;              // 0..1, smoothed loudness
    this.flux = 0;               // onset strength this frame, full band
    this.lowFlux = 0;            // onset strength below ~200 Hz: the kick
    this.brightness = 0.5;       // spectral centroid, 0..1
    this.silent = true;

    this.novelty = new Float32Array(HISTORY);
    this.noveltyAt = 0;
    this.filled = 0;
    this.hopAcc = 0;
    this.hopPeak = 0;

    this.bpm = 0;              // what he will dance on, after `octave`
    this.rawBpm = 0;           // what the autocorrelation actually found
    this.confidence = 0;
    this.halfTime = false;
    this.peaks = [];
    // Manual nudge: 0.5, 1 or 2. The estimator will not choose an octave for
    // you, because for real music there is often no single right answer — this
    // track's strongest periodicity is 116, which is the dotted pulse of its
    // own 174, while an offline pass over the whole thing prefers 88. All
    // three are really there.
    this.octave = 1;
    this.phase = 0;              // 0..1 within the current beat
    this.beatCount = 0;
    this.lastTempoAt = 0;

    this._onBeat = null;
  }

  get ready() { return this.analyser !== null; }

  onBeat(fn) { this._onBeat = fn; }

  async _start(makeSource) {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.source) { try { this.source.disconnect(); } catch {} }

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = FFT;
    // No smoothing. Spectral flux is 'energy that just appeared', and the
    // analyser's own exponential averaging smears exactly that across frames,
    // flattening the onsets the whole tempo estimate depends on.
    this.analyser.smoothingTimeConstant = 0;
    this.spectrum = new Float32Array(this.analyser.frequencyBinCount);
    this.prevSpectrum = new Float32Array(this.analyser.frequencyBinCount);
    this.wave = new Float32Array(this.analyser.fftSize);

    this.source = await makeSource();
    this.source.connect(this.analyser);
  }

  async useMic() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    await this._start(() => this.ctx.createMediaStreamSource(stream));
    this.kind = 'mic';
    this.stream = stream;
  }

  // An <audio> element, so a file plays aloud as well as being analysed.
  async useElement(el) {
    await this._start(() => this.ctx.createMediaElementSource(el));
    this.analyser.connect(this.ctx.destination);
    this.kind = 'file';
  }

  stop() {
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
    if (this.source) { try { this.source.disconnect(); } catch {} this.source = null; }
    this.analyser = null;
    this.silent = true;
    this.level = 0;
    this.bpm = 0;
    this.rawBpm = 0;
    this.confidence = 0;
  }

  // Call once a frame.
  update(now, dt) {
    if (!this.analyser) return;

    this.analyser.getFloatTimeDomainData(this.wave);
    let sum = 0;
    for (let i = 0; i < this.wave.length; i++) sum += this.wave[i] * this.wave[i];
    const rms = Math.sqrt(sum / this.wave.length);
    // Loudness reads better on a log scale; -50 dB is effectively silence.
    const db = 20 * Math.log10(Math.max(rms, 1e-6));
    const target = clamp((db + 50) / 45, 0, 1);
    this.level += (target - this.level) * Math.min(1, dt * 6);
    this.silent = this.level < 0.06;

    this.prevSpectrum.set(this.spectrum);
    this.analyser.getFloatFrequencyData(this.spectrum);

    // Spectral flux: energy that has APPEARED since last frame. Only rises
    // count, so sustained notes contribute nothing and attacks stand out.
    //
    // Two fluxes, because they are wanted for different things. Full-band
    // flux catches any attack and drives the beat phase. Low-band flux is
    // the kick, and the kick is what carries the tempo in dance music —
    // measuring tempo across the whole spectrum lets hats and cymbals, which
    // subdivide, outvote the pulse people actually move to.
    const nyquist = (this.ctx?.sampleRate ?? 48000) / 2;
    const perBin = nyquist / this.spectrum.length;
    let flux = 0, low = 0, lowW = 0, weighted = 0, total = 0;
    for (let i = 1; i < this.spectrum.length; i++) {
      const cur = Math.max(this.spectrum[i], -100);
      const prev = Math.max(this.prevSpectrum[i], -100);
      const rise = cur - prev;
      // Bass-weighted rather than bass-only. Gating to the lowest bins finds
      // the right tempo but on so little signal that confidence never rises;
      // weighting keeps every bin contributing while letting the kick win.
      const w = 1 + 3 * Math.exp(-(i * perBin) / 300);
      if (rise > 0) { flux += rise; low += rise * w; }
      lowW += w;
      const mag = Math.pow(10, cur / 20);
      weighted += mag * i;
      total += mag;
    }
    this.flux = flux / this.spectrum.length;
    this.lowFlux = low / Math.max(lowW, 1);
    if (total > 1e-9) {
      const centroid = weighted / total / this.spectrum.length;
      this.brightness += (clamp(centroid * 2.2, 0, 1) - this.brightness) * Math.min(1, dt * 0.8);
    }

    // Fixed-hop resampling: keep the loudest onset seen since the last hop, so
    // a dropped frame costs detail but never shifts the grid.
    this.hopPeak = Math.max(this.hopPeak, this.silent ? 0 : this.lowFlux);
    this.hopAcc += dt;
    let guard = 0;
    while (this.hopAcc >= HOP && guard++ < 8) {
      this.novelty[this.noveltyAt] = this.hopPeak;
      this.noveltyAt = (this.noveltyAt + 1) % HISTORY;
      this.filled = Math.min(this.filled + 1, HISTORY);
      this.hopAcc -= HOP;
      this.hopPeak = 0;
    }
    if (guard >= 8) this.hopAcc = 0;   // came back from a long stall

    if (now - this.lastTempoAt > 0.5 && this.filled > HISTORY * 0.5) {
      this._estimateTempo();
      this.lastTempoAt = now;
    }

    this._advanceBeat(dt);
  }

  // Autocorrelate the novelty curve. Reports the strongest lag in range, and
  // folds an over-fast answer down an octave — dancing on 175 looks frantic
  // where 88 looks like dancing.
  _estimateTempo() {
    const fps = HOP_RATE;
    const n = this.filled;
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) buf[i] = this.novelty[(this.noveltyAt - n + i + HISTORY * 2) % HISTORY];
    let mean = 0;
    for (let i = 0; i < n; i++) mean += buf[i];
    mean /= n;
    for (let i = 0; i < n; i++) buf[i] -= mean;

    let energy = 0;
    for (let i = 0; i < n; i++) energy += buf[i] * buf[i];
    if (energy < 1e-6) { this.confidence *= 0.7; return; }

    const lagFor = (bpm) => Math.round(fps * 60 / bpm);
    // Cap the lag at a third of the window so every candidate is backed by at
    // least three repetitions.
    const loLag = lagFor(MAX_BPM), hiLag = Math.min(lagFor(MIN_BPM), Math.floor(n / 3));
    let bestLag = 0, bestScore = -Infinity;
    // Biased estimator: divide by n, not by the number of overlapping terms.
    // Dividing by the overlap makes long lags look strong on very little
    // evidence — it was scoring 31 BPM above everything else.
    const score = (lag) => {
      let s = 0;
      for (let i = 0; i + lag < n; i++) s += buf[i] * buf[i + lag];
      return s / n;
    };
    const cache = new Map();
    const at = (lag) => {
      if (!cache.has(lag)) cache.set(lag, score(lag));
      return cache.get(lag);
    };
    // Once he has a tempo he trusts, nearby lags get a small bonus. Without
    // it the estimate hops between metrically-related families — 88 one
    // moment, its dotted 117 the next — and the dancer changes his mind about
    // the tempo mid-track, which looks like a fault rather than a groove.
    const prior = (bpm) => {
      if (!this.rawBpm || this.confidence < 0.3) return 1;
      const ratio = bpm / this.rawBpm;
      const octave = Math.abs(Math.log2(ratio));
      const near = Math.exp(-((bpm - this.rawBpm) ** 2) / (2 * 9 * 9));
      // Octave relations stay free; everything else pays for moving.
      const isOctave = Math.abs(octave - 1) < 0.04 || Math.abs(octave) < 0.04;
      return 1 + 0.5 * near + (isOctave ? 0.15 : 0);
    };

    const candidates = [];
    for (let lag = loLag; lag <= hiLag; lag++) {
      // Reward a lag whose double also lines up: that is what separates a real
      // beat from a single strong periodicity.
      const raw = at(lag) + 0.5 * (2 * lag < n ? at(2 * lag) : 0);
      const bpmHere = fps * 60 / lag;
      const s = raw * prior(bpmHere);
      candidates.push({ bpm: bpmHere, score: raw });
      if (s > bestScore) { bestScore = s; bestLag = lag; }
    }
    if (!bestLag) return;

    let bpm = fps * 60 / bestLag;
    this.halfTime = false;
    // A track that autocorrelates at 175 does so at 87.5 as well. Dance on the
    // fast one and he looks frantic, so prefer the slower reading whenever it
    // is genuinely there.
    if (bpm > 128) {
      const halfLag = Math.round(bestLag * 2);
      if (halfLag <= hiLag && at(halfLag) > at(bestLag) * 0.3) {
        bpm /= 2;
        this.halfTime = true;
      }
    }

    // Keep the strongest candidates around; a tempo estimate that cannot be
    // inspected cannot be debugged.
    candidates.sort((a, b) => b.score - a.score);
    this.peaks = candidates.slice(0, 6)
      .map((q) => ({ bpm: +q.bpm.toFixed(1), score: +(q.score / (energy / n)).toFixed(3) }));

    const conf = clamp(bestScore / (energy / n), 0, 1);
    this.confidence += (conf - this.confidence) * 0.35;
    this.rawBpm = this.rawBpm ? this.rawBpm + (bpm - this.rawBpm) * 0.3 : bpm;
    this.bpm = clamp(this.rawBpm * this.octave, 40, 220);
  }

  // A phase-locked loop: the phase runs at the estimated tempo, and each
  // onset near a beat nudges it into line rather than resetting it, so one
  // stray transient cannot throw the whole grid.
  _advanceBeat(dt) {
    if (!this.bpm || this.silent) return;
    const period = 60 / this.bpm;
    this.phase += dt / period;

    const strong = this.flux > this._threshold();
    if (strong) {
      // Error in the range -0.5..0.5 of a beat.
      let err = this.phase % 1;
      if (err > 0.5) err -= 1;
      this.phase -= err * 0.12 * clamp(this.confidence, 0.1, 1);
    }

    if (this.phase >= 1) {
      this.phase -= Math.floor(this.phase);
      this.beatCount++;
      if (this._onBeat) this._onBeat(this.beatCount);
    }
  }

  // Adaptive: a fixed threshold works in a studio and nowhere else.
  _threshold() {
    let sum = 0, count = 0;
    for (let i = 0; i < this.filled; i++) { sum += this.novelty[i]; count++; }
    const mean = count ? sum / count : 0;
    return mean * 1.6 + 0.02;
  }
}
