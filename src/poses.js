import { pose } from './figure.js';

// Six poses from the reference sheet, plus two lifted off the video.
export const POSES = {
  neutral:  pose({}),

  point:    pose({ armLU: -8, armLF: -12, armRU: 122, armRF: 138,
                   legLU: 110, legLF: 99, legRU: 66, legRF: 96 }),

  armsUp:   pose({ armLU: -10, armLF: -86, armRU: -170, armRF: -94,
                   legLU: 108, legLF: 97, legRU: 68, legRF: 98 }),

  walk:     pose({ armLU: 58, armLF: 68, armRU: 116, armRF: 122,
                   legLU: 64, legLF: 82, legRU: 116, legRF: 104 }),

  crouch:   pose({ spine: -74, neck: -84, armLU: 152, armLF: 172,
                   armRU: 28, armRF: 26,
                   legLU: 136, legLF: 74, legRU: 44, legRF: 106 }),

  pointUp:  pose({ armLU: -56, armLF: -52, armRU: 114, armRF: 106,
                   legLU: 104, legLF: 96, legRU: 70, legRF: 94 }),

  // From the video: elbow-led whip, hand sweeping across the chest.
  whip:     pose({ spine: -86, headTilt: 4,
                   armLU: -34, armLF: 46, armRU: 114, armRF: 104,
                   legLU: 98, legLF: 93, legRU: 80, legRF: 92 }),

  // From the video: one arm shot straight out, the other loose and low.
  armOut:   pose({ spine: -93, headTilt: -3,
                   armLU: 2, armLF: -4, armRU: 114, armRF: 106,
                   legLU: 86, legLF: 92, legRU: 96, legRF: 90 }),
};

export const SHEET = ['neutral', 'point', 'armsUp', 'walk', 'crouch', 'pointUp', 'whip', 'armOut'];
