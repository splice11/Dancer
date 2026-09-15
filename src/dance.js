// Choosing what to do next.
//
// One move per call, on the beat. Because the rig's springs generate every
// frame between targets, this is the entire animation system: hand it a beat
// and it hands back a pose.
//
// The goal is not variety for its own sake — it is a dancer who reads as
// having made a decision. So he commits: having picked a move he is likely to
// run it again rather than switch every phrase, which is what real dancing
// looks like and what a uniform random pick never does.

import { NEUTRAL } from './figure.js';
import { MOVES, BEATS_PER_MOVE } from './moves.js';

export class Choreographer {
  constructor(moves = MOVES, opts = {}) {
    this.moves = moves;
    this.beatsPerMove = opts.beatsPerMove ?? BEATS_PER_MOVE;

    // 0 keeps him on his favourite move; 1 makes every move equally likely.
    this.temperature = opts.temperature ?? 0.75;
    // Chance of running the same move again instead of choosing a new one.
    this.commitment = opts.commitment ?? 0.45;
    // Chance of taking a phrase off. He does not have to dance.
    this.restChance = opts.restChance ?? 0.08;
    // How much he leans into the beat: 0 is a polite sway, 1 is full size.
    this.energy = opts.energy ?? 1;

    // A private taste: some moves he just likes more. Regenerated per dancer,
    // so two of him never quite agree.
    this.taste = moves.map(() => 0.4 + Math.random() * 0.6);

    this.move = null;
    this.pos = 0;
    this.resting = false;
    this.lastIndex = -1;
  }

  pick() {
    const w = this.moves.map((m, i) => {
      let x = this.taste[i] ** (1 / Math.max(this.temperature, 0.05));
      if (i === this.lastIndex) x *= 0.25;   // don't drift into a rut
      return x;
    });
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) {
      r -= w[i];
      if (r <= 0) return i;
    }
    return w.length - 1;
  }

  // Scale a pose toward neutral. Energy 1 leaves it alone; lower flattens the
  // shapes without changing their timing, which is how a half-interested
  // dancer actually looks.
  damp(pose) {
    if (this.energy >= 0.995) return pose;
    const out = { ...pose };
    for (const k in pose) {
      if (typeof pose[k] !== 'number' || !(k in NEUTRAL)) continue;
      out[k] = NEUTRAL[k] + (pose[k] - NEUTRAL[k]) * this.energy;
    }
    return out;
  }

  // Call once per beat. Returns { pose, move, beat } — or a resting pose.
  next() {
    if (this.move === null || this.pos >= this.beatsPerMove) {
      this.pos = 0;
      if (this.resting) {
        this.resting = false;
      } else if (this.move !== null && Math.random() < this.restChance) {
        this.resting = true;
      } else if (this.move !== null && Math.random() < this.commitment) {
        // stay on the same move
      } else {
        this.lastIndex = this.move;
        this.move = this.pick();
      }
      if (this.move === null) this.move = this.pick();
    }

    if (this.resting) {
      this.pos++;
      return { pose: NEUTRAL, move: null, beat: this.pos - 1 };
    }

    const m = this.moves[this.move];
    const pose = this.damp(m.poses[this.pos % m.poses.length]);
    this.pos++;
    return { pose, move: m, beat: this.pos - 1 };
  }
}

// A steady beat clock. Calls back on each beat and never drifts, because the
// next beat time is computed from the start rather than accumulated.
export class Metronome {
  constructor(bpm = 88) {
    this.bpm = bpm;
    this.start = null;
    this.count = 0;
  }

  reset(now) { this.start = now; this.count = 0; }

  // Feed it the current time; returns how many beats have just elapsed.
  tick(now) {
    if (this.start === null) { this.reset(now); return 1; }
    const period = 60 / this.bpm;
    const due = Math.floor((now - this.start) / period) + 1;
    const fired = due - this.count;
    this.count = due;
    return Math.max(0, fired);
  }

  // 0 at the beat, approaching 1 just before the next one.
  phase(now) {
    if (this.start === null) return 0;
    const period = 60 / this.bpm;
    return ((now - this.start) % period) / period;
  }
}
