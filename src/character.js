// The character, settled.
//
// Build C from the look-dev sheet, carrying the tuning notes: hips narrowed
// and the thigh tapered at the top, head 48 -> 44, legs in 9%, arms in 6%.
// Pure black fill, white eyes, nothing else.

export const DANCER = {
  scale: 1,
  ink: '#000',
  eyeInk: '#fff',

  bones: {
    spine: 65, neck: 36,
    shoulderW: 42, hipW: 19,
    upperArm: 50, foreArm: 46,
    thigh: 53, shin: 46,
  },

  thick: {
    head: 44, neck: 14.5, chest: 17.5, pelvis: 16, shoulderDrop: 13,
    armTop: 15, elbow: 15, wrist: 14.5, hand: 15.5,
    // thighTop sits narrower than knee on purpose: that taper, plus the hip
    // bar the renderer draws between hipL and hipR, is what stops the hips
    // reading wide from any angle.
    thighTop: 15.5, knee: 17, ankle: 16,
    footLen: 26, footPitch: 6, toe: 14,
  },

  // Eyes are two discs on the head sphere, placed by a direction rather than
  // a screen offset, so they foreshorten and slip round the side as he turns.
  eye: { sep: 0.22, lift: -0.09, fwd: 0.95, r: 0.18 },
};
