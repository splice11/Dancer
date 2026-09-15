// Four candidate looks, bracketing the brief: less anatomical, bolder,
// rounder and more expressive eyes, still in good shape (not fat).
// Limb radii are quoted against a head radius of 40, so they read as a
// fraction of the head the way the reference art does.

const base = { scale: 1, ink: '#000', eyeInk: '#fff', paper: '#f4f2ec' };

export const STYLES = {
  A: {
    ...base,
    label: 'A · Reference',
    note: 'The ChatGPT sheet, rebuilt to its own proportions. Tapered forearms and calves, wedge feet, small tilted eyes.',
    foot: 'wedge',
    thick: { head: 40, neck: 9, chest: 12.5, pelvis: 10.5, shoulderDrop: 11,
             armTop: 10.5, elbow: 9, wrist: 7.5, hand: 9.5,
             thighTop: 13.5, knee: 11, ankle: 8.5,
             footLen: 26, footDrop: 3 },
    eye: { rx: 0.13, ry: 0.20, tilt: -12,
           innerX: 0.18, innerY: -0.06, outerX: 0.56, outerY: -0.02, outerScale: 0.92 },
  },

  B: {
    ...base,
    label: 'B · Bolder',
    note: 'Same skeleton, near-uniform limb thickness, blob feet, bigger rounder eyes. The literal reading of the brief.',
    foot: 'blob',
    thick: { head: 40, neck: 12, chest: 14.5, pelvis: 13.5, shoulderDrop: 11,
             armTop: 12, elbow: 12, wrist: 11.5, hand: 12.5,
             thighTop: 14.5, knee: 14, ankle: 13,
             footLen: 25, footDrop: 2 },
    eye: { rx: 0.175, ry: 0.20, tilt: -6,
           innerX: 0.17, innerY: -0.08, outerX: 0.58, outerY: -0.04, outerScale: 0.95 },
  },

  C: {
    ...base,
    label: 'C · Chunky',
    note: 'Thicker again, shorter limbs, bigger head. Most cartoon, most huggable, closest to tipping into stubby.',
    foot: 'blob',
    bones: { spine: 65, neck: 36, upperArm: 53, foreArm: 49, thigh: 58, shin: 51, shoulderW: 42, hipW: 24 },
    thick: { head: 48, neck: 14.5, chest: 17.5, pelvis: 16.5, shoulderDrop: 13,
             armTop: 15, elbow: 15, wrist: 14.5, hand: 15.5,
             thighTop: 17.5, knee: 17, ankle: 16,
             footLen: 28, footDrop: 2 },
    eye: { rx: 0.175, ry: 0.19, tilt: -4,
           innerX: 0.16, innerY: -0.09, outerX: 0.57, outerY: -0.05, outerScale: 0.95 },
  },

  D: {
    ...base,
    label: 'D · Bold athletic',
    note: 'Bold uniform limbs but longer, with a slightly smaller head, so he reads lean and springy. Roundest eyes.',
    foot: 'blob',
    bones: { spine: 66, neck: 28, upperArm: 54, foreArm: 50, thigh: 58, shin: 49 },
    thick: { head: 36, neck: 11, chest: 13.5, pelvis: 12.5, shoulderDrop: 10,
             armTop: 11.5, elbow: 11.5, wrist: 11, hand: 12,
             thighTop: 13.5, knee: 13, ankle: 12.5,
             footLen: 24, footDrop: 2 },
    eye: { rx: 0.19, ry: 0.20, tilt: -4,
           innerX: 0.16, innerY: -0.10, outerX: 0.60, outerY: -0.06, outerScale: 0.96 },
  },
};
