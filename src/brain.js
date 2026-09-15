// Whether he feels like it.
//
// The brief was an NPC who "can hear your music and can decide to dance or
// not" — so the interesting object here is not the dancing, it is the
// declining. He listens for a few bars before committing, he has opinions,
// and he is allowed to be wrong about a track or change his mind halfway
// through.
//
// Two things keep him from being a slot machine. His taste is fixed for the
// life of the instance, so he is recognisably the same guy; and his mood is
// resampled every time he judges something, so the same track can land
// differently on different days.

import { NEUTRAL } from './figure.js';
import { Choreographer } from './dance.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const bell = (x, mean, width) => Math.exp(-((x - mean) ** 2) / (2 * width * width));
const rand = (a, b) => a + Math.random() * (b - a);

export const STATES = {
  idle: 'not listening to anything in particular',
  noticing: 'something started',
  judging: 'deciding whether he likes it',
  dancing: 'committed',
  winded: 'needs a moment',
  unimpressed: 'heard it, not for him',
};

export class Brain {
  constructor(opts = {}) {
    this.chor = opts.choreographer ?? new Choreographer();

    // Fixed for this instance: who he is.
    this.taste = {
      tempo: rand(84, 126),      // BPM he moves best to
      tempoWidth: rand(20, 34),
      bright: rand(0.34, 0.68),  // how much treble he likes
      brightWidth: rand(0.22, 0.38),
      drive: rand(0.45, 0.9),    // how much loudness he needs before it lands
      pickiness: rand(0.44, 0.78),
    };

    this.state = 'idle';
    this.since = 0;
    this.verdict = 0;
    this.mood = 0;
    this.energy = 1;
    this.danceBeats = 0;
    this.sample = null;
    this.onState = null;
  }

  _go(state, now) {
    if (this.state === state) return;
    this.state = state;
    this.since = now;
    if (this.onState) this.onState(state);
  }

  // How much he likes what he is hearing, 0..1.
  //
  // Weighted GEOMETRIC mean, not a sum. A sum lets a loud track with a good
  // groove paper over a tempo he has no feel for, and he ends up dancing to
  // everything — which is not a taste, it is a slot machine that always pays.
  // A product means one weak ingredient drags the whole verdict down, the way
  // an actual opinion works.
  score(f) {
    const eps = 0.02;
    const tempo = f.bpm ? bell(f.bpm, this.taste.tempo, this.taste.tempoWidth) : 0.3;
    const bright = bell(f.brightness, this.taste.bright, this.taste.brightWidth);
    const drive = clamp(f.level / this.taste.drive, 0, 1);   // past a point, more is not better
    const groove = clamp(f.confidence, 0, 1);
    const v = Math.pow(tempo + eps, 0.38) * Math.pow(bright + eps, 0.18)
            * Math.pow(drive + eps, 0.24) * Math.pow(groove + eps, 0.20);
    return clamp(v + this.mood, 0, 1);
  }

  update(now, dt, ears) {
    const heard = ears && ears.ready && !ears.silent;

    if (!heard) {
      if (this.state !== 'idle') this._go('idle', now);
      this.sample = null;
      return this.state;
    }

    switch (this.state) {
      case 'idle':
      case 'unimpressed':
        // Give up on a track he has already rejected until it changes.
        if (this.state === 'unimpressed' && now - this.since < 12) break;
        this._go('noticing', now);
        break;

      case 'noticing':
        // A beat or two of just registering it.
        if (now - this.since > 1.4) {
          this.mood = rand(-0.17, 0.17);
          this.sample = { bpm: 0, brightness: 0, level: 0, confidence: 0, n: 0 };
          this._go('judging', now);
        }
        break;

      case 'judging': {
        const s = this.sample;
        s.n++;
        s.bpm += (ears.bpm - s.bpm) / s.n;
        s.brightness += (ears.brightness - s.brightness) / s.n;
        s.level += (ears.level - s.level) / s.n;
        s.confidence += (ears.confidence - s.confidence) / s.n;
        // Long enough to hear a phrase, not so long he feels broken.
        if (now - this.since > 3.2) {
          this.verdict = this.score(s);
          if (this.verdict > this.taste.pickiness) {
            this.energy = clamp(0.5 + this.verdict * 0.7, 0.4, 1);
            this.chor.energy = this.energy;
            this.chor.commitment = clamp(0.25 + this.verdict * 0.5, 0.2, 0.8);
            this.chor.temperature = clamp(1.15 - this.verdict * 0.6, 0.3, 1);
            this.danceBeats = 0;
            this._go('dancing', now);
          } else {
            this._go('unimpressed', now);
          }
        }
        break;
      }

      case 'dancing': {
        // Energy follows the music, so a quiet passage calms him down without
        // making him stop.
        const want = clamp(0.35 + ears.level * 0.8, 0.3, 1) * clamp(0.6 + this.verdict, 0.5, 1.25);
        this.energy += (clamp(want, 0.25, 1) - this.energy) * Math.min(1, dt * 0.8);
        this.chor.energy = this.energy;
        // Even a good song does not go on forever.
        if (this.danceBeats > 64 && Math.random() < dt * 0.25) this._go('winded', now);
        break;
      }

      case 'winded':
        if (now - this.since > rand(2.5, 6)) {
          this.danceBeats = 0;
          this._go(Math.random() < 0.8 ? 'dancing' : 'judging', now);
          if (this.state === 'judging') {
            this.since = now;
            this.sample = { bpm: 0, brightness: 0, level: 0, confidence: 0, n: 0 };
          }
        }
        break;
    }
    return this.state;
  }

  // Called on each beat. Returns a target pose, or null to leave him alone.
  beat() {
    if (this.state === 'dancing') {
      this.danceBeats++;
      const step = this.chor.next();
      return { pose: step.pose, move: step.move };
    }
    if (this.state === 'judging' || this.state === 'noticing') {
      // Listening, not dancing: a nod on the beat. It reads as considering it,
      // which is the whole point of making him wait before committing.
      return { pose: { ...NEUTRAL, headPitch: 7, neck: -86 }, move: null, nod: true };
    }
    if (this.state === 'winded') {
      return { pose: { ...NEUTRAL, headPitch: -4 }, move: null };
    }
    return null;
  }

  describe() {
    const t = this.taste;
    return `likes ${Math.round(t.tempo)} BPM ±${Math.round(t.tempoWidth)}, `
         + `${t.bright < 0.45 ? 'darker' : t.bright > 0.6 ? 'brighter' : 'mid'} tone, `
         + `${t.pickiness > 0.52 ? 'picky' : 'easy-going'}`;
  }
}
