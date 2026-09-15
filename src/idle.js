// Him just being there.
//
// The default state is not a static pose — he breathes, shifts his weight,
// blinks, and glances around. All of it is small and slow enough to read as
// alive rather than animated.

import { NEUTRAL } from './figure.js';

const TAU = Math.PI * 2;

// Cheap smooth noise: a few primes' worth of sine, so nothing visibly loops.
const wobble = (t, seed) =>
  (Math.sin(t * 0.31 + seed) + Math.sin(t * 0.53 + seed * 2.7) * 0.6
   + Math.sin(t * 0.83 + seed * 5.1) * 0.35) / 1.95;

export class Idle {
  constructor() {
    this.nextBlink = 1.5;
    this.blinkT = -1;
    this.nextGlance = 4;
    this.glance = 0;
    this.glanceTarget = 0;
  }

  // Returns a target pose for the rig, plus the blink value to apply directly.
  step(t, dt) {
    // Blink: a fast close, a slower open. Roughly every 2-6 s.
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      if (this.blinkT > 0.16) { this.blinkT = -1; this.nextBlink = 2 + Math.random() * 4; }
    } else {
      this.nextBlink -= dt;
      if (this.nextBlink <= 0) this.blinkT = 0;
    }
    let blink = 1;
    if (this.blinkT >= 0) {
      const u = this.blinkT / 0.16;
      blink = u < 0.4 ? 1 - u / 0.4 : (u - 0.4) / 0.6;
    }

    // Glance: occasionally he looks off to one side and comes back.
    this.nextGlance -= dt;
    if (this.nextGlance <= 0) {
      this.glanceTarget = (Math.random() - 0.5) * 14;
      this.nextGlance = 3 + Math.random() * 6;
      setTimeout(() => { this.glanceTarget = 0; }, 700 + Math.random() * 1200);
    }
    this.glance += (this.glanceTarget - this.glance) * Math.min(1, dt * 3);

    const breath = Math.sin(t * TAU / 4.2);          // ~4.2 s cycle
    const sway = wobble(t, 1.7);
    const drift = wobble(t, 4.1);

    return {
      pose: {
        ...NEUTRAL,
        spine: -90 + sway * 1.6,
        neck: -90 - breath * 1.1 + sway * 0.8,
        headTilt: this.glance + drift * 2.2,

        armLU: 70 + breath * 1.8 + sway * 2.4,
        armLF: 76 + breath * 2.6 + sway * 3.0,
        armRU: 110 - breath * 1.8 - sway * 2.4,
        armRF: 104 - breath * 2.2 - sway * 2.8,

        legLU: 81 + sway * 0.7,
        legLF: 86 + sway * 0.5,
        legRU: 100 - sway * 0.7,
        legRF: 94 - sway * 0.5,
      },
      blink,
    };
  }
}
