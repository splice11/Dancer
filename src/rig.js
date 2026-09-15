// Secondary motion.
//
// Every bone angle is a damped spring chasing a target angle. Distal bones
// are softer and less damped than the ones that drive them, so the elbow
// leads and the hand trails and overshoots — which is what the loose arm
// whips in the reference video actually are.
//
// The useful consequence: a dance move is just a target pose. Set a new
// target on the beat and the springs generate every in-between frame,
// including the follow-through. Almost no keyframes needed.

import { NEUTRAL } from './figure.js';

// Channels that are sprung. `facing`, `footL`, `footR` and `blink` are set
// directly — they are not physical bone angles.
export const CHANNELS = [
  'spine', 'neck', 'headTilt',
  'armLU', 'armLF', 'armRU', 'armRF',
  'legLU', 'legLF', 'legRU', 'legRF',
];

// Stiffness sets how fast a move lands; the damping ratio alone sets how far
// it sails past. Overshoot is exp(-pi*z / sqrt(1 - z*z)), so z 0.46 gives the
// forearm ~19% of its travel in follow-through.
//
// Stiffness is tuned against the reference track's 87 BPM pulse: a 0.69 s
// beat, with the move landing in ~0.55 s so the limb is still faintly moving
// when the next beat arrives.
export const PROFILE = {
  spine:    { k: 600, z: 0.90 },
  neck:     { k: 450, z: 0.62 },
  headTilt: { k: 390, z: 0.55 },

  armLU:    { k: 525, z: 0.72 },   // shoulder drives
  armLF:    { k: 315, z: 0.46 },   // elbow trails and whips
  armRU:    { k: 525, z: 0.72 },
  armRF:    { k: 315, z: 0.46 },

  legLU:    { k: 585, z: 0.82 },
  legLF:    { k: 390, z: 0.60 },
  legRU:    { k: 585, z: 0.82 },
  legRF:    { k: 390, z: 0.60 },
};

// Shortest signed way round from a to b, so a target across ±180 does not
// send the limb the long way.
export function shortest(a, b) {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

const SUBSTEP = 1 / 240;

export class Rig {
  constructor(pose = NEUTRAL, profile = PROFILE) {
    this.profile = { ...profile };
    this.pose = { ...NEUTRAL, ...pose };
    this.target = { ...this.pose };
    this.vel = Object.fromEntries(CHANNELS.map((c) => [c, 0]));
    this.looseness = 1;   // scales overshoot globally; 0 = stiff, >1 = floppier
  }

  // Aim at a new pose. Unsprung keys apply immediately.
  setTarget(pose) {
    this.target = { ...this.target, ...pose };
    for (const k of ['facing', 'footL', 'footR', 'blink']) {
      if (k in pose) this.pose[k] = pose[k];
    }
  }

  // Kick a channel's velocity directly, for accents that should snap rather
  // than ease — a hit on the beat.
  impulse(channel, degreesPerSecond) {
    if (channel in this.vel) this.vel[channel] += degreesPerSecond;
  }

  step(dt) {
    // Clamp so a backgrounded tab does not explode the integrator.
    let remaining = Math.min(dt, 0.1);
    while (remaining > 0) {
      const h = Math.min(SUBSTEP, remaining);
      remaining -= h;
      for (const c of CHANNELS) {
        const p = this.profile[c];
        const k = p.k;
        const z = p.z / Math.max(this.looseness, 0.05);
        const damping = 2 * z * Math.sqrt(k);
        const err = shortest(this.pose[c], this.target[c]);
        this.vel[c] += (k * err - damping * this.vel[c]) * h;
        this.pose[c] += this.vel[c] * h;
      }
    }
    return this.pose;
  }

  // True once every sprung channel has effectively arrived.
  settled(tolDeg = 0.4, tolVel = 2) {
    return CHANNELS.every((c) =>
      Math.abs(shortest(this.pose[c], this.target[c])) < tolDeg &&
      Math.abs(this.vel[c]) < tolVel);
  }
}
