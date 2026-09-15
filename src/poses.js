// The pose library.
//
// Each bone carries a pitch and a yaw (`<bone>Y`). Pitch swings it forward and
// back; yaw swings it out to the side. `turn` is the whole body's yaw: 0 faces
// the camera, 90 is the old side-on view.
//
// These are authored to read from a near-front camera, because that is how the
// reference video is shot — the dancers face the lens and work laterally.

import { NEUTRAL } from './figure.js';

// A pose is the neutral stance with the named angles replaced. Anything left
// out keeps its resting value rather than collapsing to zero.
export function pose(o) { return { ...NEUTRAL, ...o }; }

export const POSES = {
  neutral: pose({}),

  // Arm out to his left and slightly forward. Pointing at the lens
  // foreshortens to nothing, so he points across himself instead.
  point: pose({
    turn: 34,
    armLU: 2, armLUY: -74, armLF: -6, armLFY: -80,
    armRU: 86, armRUY: 44, armRF: 88, armRFY: 34,
    legLU: 84, legLUY: -52, legLF: 88, legLFY: -24,
    legRU: 78, legRUY: 58, legRF: 86, legRFY: 30,
  }),

  // Both arms up and wide, elbows out.
  armsUp: pose({
    turn: 12,
    armLU: -40, armLUY: -84, armLF: -84, armLFY: -66,
    armRU: -40, armRUY: 84, armRF: -84, armRFY: 66,
    legLU: 82, legLUY: -58, legLF: 87, legLFY: -28,
    legRU: 82, legRUY: 58, legRF: 87, legRFY: 28,
  }),

  // A stride only reads from the side, so this pose turns him.
  walk: pose({
    turn: 74,
    armLU: 62, armLUY: -16, armLF: 72, armLFY: -10,
    armRU: 112, armRUY: 14, armRF: 118, armRFY: 8,
    legLU: 62, legLUY: -12, legLF: 80, legLFY: -8,
    legRU: 114, legRUY: 12, legRF: 104, legRFY: 8,
  }),

  crouch: pose({
    turn: 16,
    spine: -80, neck: -86,
    armLU: 30, armLUY: -88, armLF: 16, armLFY: -86,
    armRU: 30, armRUY: 88, armRF: 16, armRFY: 86,
    legLU: 62, legLUY: -80, legLF: 88, legLFY: -34,
    legRU: 62, legRUY: 80, legRF: 88, legRFY: 34,
  }),

  pointUp: pose({
    turn: 28,
    armLU: -62, armLUY: -66, armLF: -66, armLFY: -60,
    armRU: 92, armRUY: 52, armRF: 96, armRFY: 40,
    legLU: 84, legLUY: -54, legLF: 88, legLFY: -26,
    legRU: 82, legRUY: 58, legRF: 87, legRFY: 28,
  }),

  // From the video: elbow high and out, forearm dropping through the swing.
  whip: pose({
    turn: 26, headTilt: 5,
    armLU: -30, armLUY: -80, armLF: 44, armLFY: -84,
    armRU: 96, armRUY: 50, armRF: 104, armRFY: 38,
    legLU: 83, legLUY: -54, legLF: 87, legLFY: -26,
    legRU: 81, legRUY: 58, legRF: 86, legRFY: 28,
  }),

  // From the video: one arm shot straight out, the other loose and low.
  armOut: pose({
    turn: 14, headTilt: -4,
    armLU: 0, armLUY: -90, armLF: -2, armLFY: -90,
    armRU: 94, armRUY: 54, armRF: 100, armRFY: 40,
    legLU: 82, legLUY: -56, legLF: 87, legLFY: -27,
    legRU: 82, legRUY: 56, legRF: 87, legRFY: 27,
  }),

  // He turns his back. Only possible now, and worth having.
  away: pose({
    turn: 190,
    armLU: 76, armLUY: -50, armLF: 80, armLFY: -40,
    armRU: 76, armRUY: 50, armRF: 80, armRFY: 40,
  }),
};

export const SHEET = Object.keys(POSES);
