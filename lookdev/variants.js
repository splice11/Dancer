// Fine-tuning pass around build C, following the notes on the first sheet:
//   - the hips flare, because the thighs emerge wider than the torso
//   - head slightly too big
//   - legs slightly too long
//   - arms very slightly too long
//
// Every variant below is build C with only the named numbers changed.

import { STYLES } from './styles.js';

const C = STYLES.C;
const mk = (label, note, bones = {}, thick = {}) => ({
  ...C, label, note,
  bones: { ...C.bones, ...bones },
  thick: { ...C.thick, ...thick },
});

// The thighs reach hipW/2 + thighTop from the centreline; the pelvis reaches
// only `pelvis`. The difference is the flare.
export const reach = (st) => st.bones.hipW / 2 + st.thick.thighTop;
export const flare = (st) => reach(st) - st.thick.pelvis;

// --- the hip flare, three routes ------------------------------------------
// Widening the torso is the suggested fix, and it does kill the flare — but
// it also swallows the arms, which hang close to the body at rest, and the
// silhouette goes barrel-shaped. Narrowing the hips costs nothing, and the
// legs still part well short of a single point.

export const HIPS = [
  mk('build C', 'flare of 13', {}, {}),
  mk('torso 25', 'kills the flare, eats the arms', {}, { pelvis: 25, chest: 21 }),
  mk('hips 15', 'flare of 8', { hipW: 15 }, {}),
  mk('hips 11', 'flare of 5', { hipW: 11 }, {}),
  mk('hips 11, pelvis 19.5, thigh 15.5', 'flare of 1.5 — the pick', { hipW: 11 }, { pelvis: 19.5, thighTop: 15.5 }),
];

// Baseline carrying the hip fix, before the length and head notes.
const HIP_FIX = { bones: { hipW: 11 }, thick: { pelvis: 19.5, thighTop: 15.5 } };
const b = (o = {}) => ({ ...HIP_FIX.bones, ...o });
const t = (o = {}) => ({ ...HIP_FIX.thick, ...o });

// --- single-axis sweeps ----------------------------------------------------

export const SWEEPS = [
  {
    title: 'Head size',
    note: 'Radius. Build C was 48.',
    items: [48, 46, 44, 42, 40].map((h, i) =>
      mk(`head ${h}`, i === 0 ? 'build C as-is' : '', b(), t({ head: h }))),
  },
  {
    title: 'Leg length',
    note: 'Thigh + shin. Build C was 58 + 51 = 109.',
    items: [[58, 51], [55, 48], [53, 46], [50, 43], [47, 41]].map(([th, sh], i) =>
      mk(`${th + sh}`, i === 0 ? 'build C as-is' : `−${Math.round((1 - (th + sh) / 109) * 100)}%`,
         b({ thigh: th, shin: sh }), t({ head: 44 }))),
  },
  {
    title: 'Arm length',
    note: 'Upper + fore. Build C was 53 + 49 = 102.',
    items: [[53, 49], [51, 47], [50, 46], [48, 44], [46, 42]].map(([u, f], i) =>
      mk(`${u + f}`, i === 0 ? 'build C as-is' : `−${Math.round((1 - (u + f) / 102) * 100)}%`,
         b({ upperArm: u, foreArm: f, thigh: 53, shin: 46 }), t({ head: 44 }))),
  },
];

// --- combined candidates, weak to strong ----------------------------------

export const CANDIDATES = [
  mk('V1 · Light touch',
     'Hip fix, head 46, legs and arms in ~5%.',
     b({ thigh: 55, shin: 48, upperArm: 51, foreArm: 47 }), t({ head: 46 })),

  mk('V2 · Balanced',
     'Hip fix, head 44, legs in 9%, arms in 6%. My pick.',
     b({ thigh: 53, shin: 46, upperArm: 50, foreArm: 46 }), t({ head: 44 })),

  mk('V3 · Strong',
     'Hip fix, head 42, legs in 14%, arms in 10%.',
     b({ thigh: 50, shin: 43, upperArm: 48, foreArm: 44 }), t({ head: 42 })),

  mk('V4 · Balanced + your torso idea',
     'V2 with the pelvis also out to 22, as far as it goes before he reads heavy.',
     b({ thigh: 53, shin: 46, upperArm: 50, foreArm: 46 }), t({ head: 44, pelvis: 22, chest: 19 })),
];

export const PICK = CANDIDATES[1];
