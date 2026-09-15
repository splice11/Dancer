// Procedural stick-figure renderer.
// The whole art style lives here: bones are drawn as tapered capsules
// (the convex hull of two circles), so joints blend seamlessly and the
// figure can hit any pose without a single sprite.

const D = Math.PI / 180;

// --- geometry -------------------------------------------------------------

// Filled hull of circle(p0,r0) and circle(p1,r1). Rounded caps for free.
function capsule(ctx, x0, y0, r0, x1, y1, r1) {
  const dx = x1 - x0, dy = y1 - y0;
  const d = Math.hypot(dx, dy);
  if (d < 1e-4 || d <= Math.abs(r1 - r0)) {
    const big = r0 > r1 ? [x0, y0, r0] : [x1, y1, r1];
    ctx.beginPath();
    ctx.arc(big[0], big[1], big[2], 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const base = Math.atan2(dy, dx);
  const theta = Math.acos(Math.max(-1, Math.min(1, (r0 - r1) / d)));
  ctx.beginPath();
  ctx.arc(x0, y0, r0, base + theta, base - theta + Math.PI * 2, false);
  ctx.arc(x1, y1, r1, base - theta, base + theta, false);
  ctx.closePath();
  ctx.fill();
}

function dot(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// --- rig ------------------------------------------------------------------

// Bone lengths, in style units. Scaled per style.
const BONES = {
  // Measured off the reference sheet: total height is 3.0 head diameters and
  // limb width is 0.34 of head diameter. Head radius 40 => height 243.
  spine: 62, neck: 30,
  shoulderW: 36, hipW: 21,
  upperArm: 50, foreArm: 46,
  thigh: 55, shin: 48,
};

// Absolute (world) bone angles in degrees. -90 is straight up, +90 straight
// down. World angles because that is exactly what 2D pose estimation gives
// us, so retargeting mocap later is a direct assignment.
export const NEUTRAL = {
  facing: 1, headTilt: 0, blink: 1,
  spine: -90, neck: -90,
  armLU: 70, armLF: 76, armRU: 110, armRF: 104,
  // Narrow hips put the ankles almost on top of each other, so the resting
  // stance carries a little front-to-back separation and the legs read as two.
  legLU: 81, legLF: 86, legRU: 100, legRF: 94,
  footL: 0, footR: 0,
};

export function pose(overrides) { return { ...NEUTRAL, ...overrides }; }

// Resolve a pose into world-space joint positions.
export function solve(style, p) {
  const s = style.scale, f = p.facing;
  const B = { ...BONES, ...(style.bones || {}) };
  const step = (x, y, deg, len) => [x + Math.cos(deg * D) * len * s * f, y + Math.sin(deg * D) * len * s];

  const pelvis = [0, 0];
  const chest = step(pelvis[0], pelvis[1], p.spine, B.spine);
  const head = step(chest[0], chest[1], p.neck, B.neck);

  // Shoulders and hips ride perpendicular to their parent bone.
  const perp = (origin, deg, w) => {
    const a = (deg + 90) * D;
    return [
      [origin[0] + Math.cos(a) * w * 0.5 * s * f, origin[1] + Math.sin(a) * w * 0.5 * s],
      [origin[0] - Math.cos(a) * w * 0.5 * s * f, origin[1] - Math.sin(a) * w * 0.5 * s],
    ];
  };
  // Shoulders sit a little way back down the spine from the neck joint, so
  // the head can overlap the torso the way the reference does without arms
  // appearing to grow out of his face.
  const drop = (style.thick.shoulderDrop ?? 12) * s;
  const chestTop = [chest[0] - Math.cos(p.spine * D) * drop * f,
                    chest[1] - Math.sin(p.spine * D) * drop];
  const [shoulderL, shoulderR] = perp(chestTop, p.spine, B.shoulderW);
  const [hipL, hipR] = perp(pelvis, p.spine, B.hipW);

  const elbowL = step(shoulderL[0], shoulderL[1], p.armLU, B.upperArm);
  const wristL = step(elbowL[0], elbowL[1], p.armLF, B.foreArm);
  const elbowR = step(shoulderR[0], shoulderR[1], p.armRU, B.upperArm);
  const wristR = step(elbowR[0], elbowR[1], p.armRF, B.foreArm);

  const kneeL = step(hipL[0], hipL[1], p.legLU, B.thigh);
  const ankleL = step(kneeL[0], kneeL[1], p.legLF, B.shin);
  const kneeR = step(hipR[0], hipR[1], p.legRU, B.thigh);
  const ankleR = step(kneeR[0], kneeR[1], p.legRF, B.shin);

  return { pelvis, chest, chestTop, head, shoulderL, shoulderR, hipL, hipR,
           elbowL, wristL, elbowR, wristR, kneeL, ankleL, kneeR, ankleR };
}

// --- draw -----------------------------------------------------------------

export function draw(ctx, style, p, ox, oy) {
  const j = solve(style, p);
  const s = style.scale, f = p.facing;
  const T = style.thick;
  const r = (k) => T[k] * s;

  ctx.save();
  ctx.translate(ox, oy);
  ctx.fillStyle = style.ink;

  // Far-side limbs first so the near side reads on top.
  const limb = (a, b, c, ra, rb, rc, tipR) => {
    capsule(ctx, a[0], a[1], ra, b[0], b[1], rb);
    capsule(ctx, b[0], b[1], rb, c[0], c[1], rc);
    if (tipR) dot(ctx, c[0], c[1], tipR);
  };

  const foot = (ankle) => {
    if (style.foot === 'none') { dot(ctx, ankle[0], ankle[1], r('ankle')); return; }
    const len = style.foot === 'blob' ? T.footLen * 0.62 : T.footLen;
    const tip = style.foot === 'blob' ? r('ankle') * 0.98 : r('ankle') * 0.72;
    capsule(ctx, ankle[0], ankle[1], r('ankle'), ankle[0] + len * s * f, ankle[1] + T.footDrop * s, tip);
  };

  // legs (far, then near)
  limb(j.hipR, j.kneeR, j.ankleR, r('thighTop'), r('knee'), r('ankle'));
  foot(j.ankleR);
  limb(j.hipL, j.kneeL, j.ankleL, r('thighTop'), r('knee'), r('ankle'));
  foot(j.ankleL);

  // torso
  capsule(ctx, j.pelvis[0], j.pelvis[1], r('pelvis'), j.chestTop[0], j.chestTop[1], r('chest'));
  capsule(ctx, j.chestTop[0], j.chestTop[1], r('chest'), j.head[0], j.head[1], r('neck'));

  // arms (far, then near)
  limb(j.shoulderR, j.elbowR, j.wristR, r('armTop'), r('elbow'), r('wrist'), r('hand'));
  limb(j.shoulderL, j.elbowL, j.wristL, r('armTop'), r('elbow'), r('wrist'), r('hand'));

  // head
  const hr = T.head * s;
  dot(ctx, j.head[0], j.head[1], hr);

  // eyes
  const E = style.eye;
  ctx.fillStyle = style.eyeInk || '#fff';
  const tilt = (p.headTilt + E.tilt * f) * D;
  for (const e of [[E.innerX, E.innerY, 1], [E.outerX, E.outerY, E.outerScale]]) {
    const ex = j.head[0] + e[0] * hr * f;
    const ey = j.head[1] + e[1] * hr;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(tilt);
    ctx.beginPath();
    const open = p.blink ?? 1;
    ctx.ellipse(0, 0, E.rx * hr * e[2], E.ry * hr * e[2] * open, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
