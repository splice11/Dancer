// Him just being there.
//
// The default state is not a static pose — he breathes, shifts his weight,
// blinks, and looks around. All of it small and slow enough to read as alive
// rather than animated.
//
// Now that the rig has a third axis he can also turn his head, which is the
// cheapest personality in the whole project: a figure that looks at you reads
// as present in a way no amount of limb motion does.

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
    this.nextGlance = 3;
    this.glanceYaw = 0;
    this.glancePitch = 0;
    this.glanceHold = 0;

    // When set, he looks here instead of glancing at random: { yaw, pitch } in
    // degrees, as an OFFSET from his neutral facing, so body turn plus head
    // turn lands exactly on it.
    this.lookAt = null;
    // How much of a look-at his body follows, rather than just his head.
    this.bodyFollow = 0.35;
  }

  step(t, dt) {
    // Blink: a fast close, a slower open, roughly every 2-6 s.
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

    // Where he wants to be looking.
    let wantYaw, wantPitch;
    if (this.lookAt) {
      wantYaw = this.lookAt.yaw;
      wantPitch = this.lookAt.pitch;
    } else {
      if (this.glanceHold > 0) {
        // Holding a glance. When it runs out he comes back to centre.
        this.glanceHold -= dt;
        if (this.glanceHold <= 0) { this.glanceYaw = 0; this.glancePitch = 0; }
      } else {
        this.nextGlance -= dt;
        if (this.nextGlance <= 0) {
          // A third of glances are a real look away; the rest are small
          // shifts, so he settles rather than swivelling constantly.
          const away = Math.random() < 0.34;
          this.glanceYaw = away ? (Math.random() - 0.5) * 70 : (Math.random() - 0.5) * 18;
          this.glancePitch = away ? (Math.random() - 0.5) * 18 : 0;
          this.glanceHold = 0.8 + Math.random() * 2.2;
          this.nextGlance = 2.5 + Math.random() * 5;
        }
      }
      wantYaw = this.glanceYaw;
      wantPitch = this.glancePitch;
    }

    const breath = Math.sin(t * TAU / 4.2);          // ~4.2 s cycle
    const sway = wobble(t, 1.7);
    const drift = wobble(t, 4.1);

    // The head leads; the body follows part of the way, late.
    const bodyTurn = NEUTRAL.turn + wantYaw * this.bodyFollow + sway * 1.4;
    const headTurn = wantYaw * (1 - this.bodyFollow) + drift * 2.5;

    return {
      pose: {
        ...NEUTRAL,
        turn: bodyTurn,
        headTurn,
        headPitch: wantPitch + breath * 0.6,
        headTilt: drift * 2.0,

        spine: -90 + sway * 1.4,
        neck: -90 - breath * 1.0,

        armLU: NEUTRAL.armLU + breath * 1.6 + sway * 2.0,
        armLF: NEUTRAL.armLF + breath * 2.4 + sway * 2.6,
        armLUY: NEUTRAL.armLUY - sway * 2.2,
        armLFY: NEUTRAL.armLFY - sway * 1.6,

        armRU: NEUTRAL.armRU + breath * 1.6 - sway * 2.0,
        armRF: NEUTRAL.armRF + breath * 2.4 - sway * 2.6,
        armRUY: NEUTRAL.armRUY - sway * 2.2,
        armRFY: NEUTRAL.armRFY - sway * 1.6,

        legLU: NEUTRAL.legLU + sway * 0.6,
        legRU: NEUTRAL.legRU - sway * 0.6,
      },
      blink,
    };
  }
}
