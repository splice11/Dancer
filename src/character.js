// The character, settled.
//
// Build C from the first look-dev sheet, carrying the tuning notes:
//   - hips narrowed and the thigh tapered at the top, so the hip flare drops
//     from 13 to 1.5 without widening the torso (which swallows the arms and
//     makes him read heavy)
//   - head 48 -> 44
//   - legs in 9%, arms in 6%
//
// Pure black fill, white eyes, nothing else.

export const DANCER = {
  scale: 1,
  ink: '#000',
  eyeInk: '#fff',
  foot: 'blob',

  bones: {
    spine: 65, neck: 36,
    shoulderW: 42, hipW: 11,
    upperArm: 50, foreArm: 46,
    thigh: 53, shin: 46,
  },

  thick: {
    head: 44, neck: 14.5, chest: 17.5, pelvis: 19.5, shoulderDrop: 13,
    armTop: 15, elbow: 15, wrist: 14.5, hand: 15.5,
    // thighTop sits narrower than knee on purpose: that taper is what stops
    // the hips reading wide.
    thighTop: 15.5, knee: 17, ankle: 16,
    footLen: 28, footDrop: 2,
  },

  eye: {
    rx: 0.175, ry: 0.19, tilt: -4,
    innerX: 0.16, innerY: -0.09,
    outerX: 0.57, outerY: -0.05, outerScale: 0.95,
  },
};
