// The rig and the renderer.
//
// The skeleton is 3D; the renderer is not. Joints are solved in body-local
// space, turned, projected to the screen, then drawn as the same flat black
// tapered capsules as before. That works because the art style has no
// surface — no texture, no shading, no normals — so a capsule looks identical
// from every angle. All of 3D's usual cost lives in the surface he doesn't
// have.

const D = Math.PI / 180;

// Camera distance in style units. Large enough that perspective reads as a
// gentle sense of depth rather than a fisheye.
const CAM = 950;

// --- geometry -------------------------------------------------------------

// Filled hull of circle(p0,r0) and circle(p1,r1). Rounded caps for free.
function capsule(ctx, x0, y0, r0, x1, y1, r1) {
  const dx = x1 - x0, dy = y1 - y0;
  const d = Math.hypot(dx, dy);
  if (d < 1e-4 || d <= Math.abs(r1 - r0)) {
    const big = r0 > r1 ? [x0, y0, r0] : [x1, y1, r1];
    ctx.beginPath();
    ctx.arc(big[0], big[1], Math.max(big[2], 0.01), 0, Math.PI * 2);
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
  ctx.arc(x, y, Math.max(r, 0.01), 0, Math.PI * 2);
  ctx.fill();
}

// A bone direction from two angles, in body-local space.
//   x = his left/right, y = down, z = the way he faces
// pitch 0 points straight forward, -90 straight up, +90 straight down.
// yaw 0 keeps the bone in the sagittal plane (swinging forward and back);
// yaw +-90 swings it out to the side.
export function boneDir(pitch, yaw) {
  const p = pitch * D, y = yaw * D, cp = Math.cos(p);
  return [cp * Math.sin(y), Math.sin(p), cp * Math.cos(y)];
}

const add = (a, b, len) => [a[0] + b[0] * len, a[1] + b[1] * len, a[2] + b[2] * len];

// Rotate about the vertical axis. turn 90 puts his forward along +x, which
// reproduces the old side-on view exactly.
export function turnY(v, deg) {
  const t = deg * D, c = Math.cos(t), s = Math.sin(t);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

// --- rig ------------------------------------------------------------------

export const BONES = {
  // Measured off the reference sheet: total height is 3.0 head diameters and
  // limb width is 0.34 of head diameter. Head radius 40 => height 243.
  spine: 65, neck: 36,
  shoulderW: 42, hipW: 19,
  upperArm: 50, foreArm: 46,
  thigh: 53, shin: 46,
};

// Every bone carries a pitch and a yaw; `<bone>Y` is the yaw and defaults to
// zero, so a pose written before the rig gained an axis still reads.
export const NEUTRAL = {
  turn: 20, headTurn: 0, headPitch: 0, headTilt: 0, blink: 1,

  spine: -90, spineY: 0,
  neck: -90, neckY: 0,

  armLU: 80, armLUY: -60, armLF: 84, armLFY: -50,
  armRU: 80, armRUY: 60, armRF: 84, armRFY: 50,

  // A slight fore/aft stagger, so a side-on view does not hide one leg exactly
  // behind the other.
  legLU: 78, legLUY: -56, legLF: 85, legLFY: -26,
  legRU: 84, legRUY: 56, legRF: 88, legRFY: 26,
};

// Solve into body-local 3D, then turn, then project to the screen.
// Each joint comes back as [screenX, screenY, projectionFactor, depth], so
// callers that only read x and y keep working.
export function solve(style, p) {
  const s = style.scale ?? 1;
  const B = { ...BONES, ...(style.bones || {}) };
  const T = style.thick;

  // A pose written with the old `facing` flag maps onto a body turn.
  const turn = p.turn !== undefined ? p.turn
             : (p.facing === -1 ? -90 : 90);

  const A = (k) => p[k] ?? 0;
  const step = (from, pitchKey, len) =>
    add(from, boneDir(A(pitchKey), A(pitchKey + 'Y')), len);

  const pelvis = [0, 0, 0];
  const chest = step(pelvis, 'spine', B.spine);
  const head = step(chest, 'neck', B.neck);

  // Shoulders sit back down the spine from the neck joint so the head can
  // overlap the torso without arms appearing to grow out of his face.
  const drop = T.shoulderDrop ?? 12;
  const sdir = boneDir(A('spine'), A('spineY'));
  const chestTop = [chest[0] - sdir[0] * drop, chest[1] - sdir[1] * drop, chest[2] - sdir[2] * drop];

  // L is his left: local -x. Lateral now, which is the whole point — at a
  // front-on turn the shoulders separate across the screen, and at a side-on
  // turn they separate in depth.
  const lat = (o, w) => [[o[0] - w / 2, o[1], o[2]], [o[0] + w / 2, o[1], o[2]]];
  const [shoulderL, shoulderR] = lat(chestTop, B.shoulderW);
  const [hipL, hipR] = lat(pelvis, B.hipW);

  const elbowL = step(shoulderL, 'armLU', B.upperArm);
  const wristL = step(elbowL, 'armLF', B.foreArm);
  const elbowR = step(shoulderR, 'armRU', B.upperArm);
  const wristR = step(elbowR, 'armRF', B.foreArm);

  const kneeL = step(hipL, 'legLU', B.thigh);
  const ankleL = step(kneeL, 'legLF', B.shin);
  const kneeR = step(hipR, 'legRU', B.thigh);
  const ankleR = step(kneeR, 'legRF', B.shin);

  // Feet point the way he faces.
  const fwd = boneDir(T.footPitch ?? 4, 0);
  const toeL = add(ankleL, fwd, T.footLen);
  const toeR = add(ankleR, fwd, T.footLen);

  const local = { pelvis, chest, chestTop, head, shoulderL, shoulderR,
                  hipL, hipR, elbowL, wristL, elbowR, wristR,
                  kneeL, ankleL, kneeR, ankleR, toeL, toeR };

  const out = {};
  for (const k in local) {
    const v = turnY(local[k], turn);
    const f = CAM / (CAM - v[2]);
    out[k] = [v[0] * f * s, v[1] * f * s, f * s, v[2]];
  }
  out.turn = turn;
  return out;
}

// Which bone each pitch channel swings. The editor needs this to turn a drag
// back into a pitch and a yaw.
export const CHANNEL_BONE = {
  spine: 'spine', neck: 'neck',
  armLU: 'upperArm', armLF: 'foreArm', armRU: 'upperArm', armRF: 'foreArm',
  legLU: 'thigh', legLF: 'shin', legRU: 'thigh', legRF: 'shin',
};

// Turn a point on screen into the pitch and yaw that aim a bone at it.
//
// Two screen constraints, two degrees of freedom, so it solves exactly — but
// the tip's own perspective factor depends on where the tip ends up, so it
// takes a few passes to converge. Lives here rather than in the editor
// because it has to agree with solve() about the projection.
export function aimBone(style, p, channel, fromJoint, sx, sy) {
  const s = style.scale ?? 1;
  const B = { ...BONES, ...(style.bones || {}) };
  const len = B[CHANNEL_BONE[channel]];
  const turn = p.turn !== undefined ? p.turn : (p.facing === -1 ? -90 : 90);

  const J = solve(style, p);
  const P = J[fromJoint];
  const px = P[0] / P[2], py = P[1] / P[2], pz = P[3];

  // Keep the bone on whichever side of the view plane it already sits.
  const sign = turnY(boneDir(p[channel] ?? 0, p[channel + 'Y'] ?? 0), turn)[2] < 0 ? -1 : 1;

  let f = P[2], d = [0, 0, 0];
  for (let i = 0; i < 4; i++) {
    let dx = (sx / f - px) / len;
    let dy = (sy / f - py) / len;
    const flat = dx * dx + dy * dy;
    let dz;
    if (flat >= 1) { const k = 1 / Math.sqrt(flat); dx *= k; dy *= k; dz = 0; }
    else dz = Math.sqrt(1 - flat) * sign;
    d = [dx, dy, dz];
    f = CAM / (CAM - (pz + dz * len)) * s;
  }

  const local = turnY(d, -turn);
  return {
    pitch: Math.asin(Math.max(-1, Math.min(1, local[1]))) * 180 / Math.PI,
    yaw: Math.atan2(local[0], local[2]) * 180 / Math.PI,
  };
}

// How far below the pelvis origin his lowest point sits, so a page can stand
// him on a floor at any scale or pose. Kept here because it needs the joint
// radii, and a page that recomputes it silently breaks when a bone changes.
export function groundOffset(style, p = NEUTRAL) {
  const J = solve(style, p);
  const T = style.thick;
  return Math.max(
    J.ankleL[1] + T.ankle * J.ankleL[2],
    J.ankleR[1] + T.ankle * J.ankleR[2],
    J.toeL[1] + (T.toe ?? T.ankle) * J.toeL[2],
    J.toeR[1] + (T.toe ?? T.ankle) * J.toeR[2],
  );
}

// --- eyes -----------------------------------------------------------------

// Two discs sitting on the front of the head sphere. Because they ride the
// sphere they foreshorten as he turns and slip round the side — which is what
// lets him look at you, or away.
function rotX(v, deg) {
  const t = deg * D, c = Math.cos(t), s = Math.sin(t);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

function eyeParts(style, p, J, ox, oy) {
  const E = style.eye;
  const s = style.scale ?? 1;
  const hr = style.thick.head * J.head[2];
  const headYaw = J.turn + (p.headTurn ?? 0);
  const headPitch = p.headPitch ?? 0;
  const tilt = (p.headTilt ?? 0) * D;
  const open = p.blink ?? 1;
  const sep = E.sep ?? 0.23, lift = E.lift ?? -0.10, fwd = E.fwd ?? 0.96;
  const out = [];

  for (const side of [-1, 1]) {
    const n0 = [side * sep, lift, fwd];
    const m = Math.hypot(n0[0], n0[1], n0[2]);
    // Pitch about his own lateral axis first, then yaw about the vertical:
    // that order is what lets him raise his eyes and turn his head at once.
    const n = turnY(rotX([n0[0] / m, n0[1] / m, n0[2] / m], headPitch), headYaw);

    // Facing ratio: 1 dead-on, 0 at the horizon of the sphere.
    const face = n[2];
    if (face <= 0.12) continue;

    const rr = style.thick.head * 0.995;
    const c = [n[0] * rr, n[1] * rr, n[2] * rr];
    const cf = CAM / (CAM - (J.head[3] + c[2]));

    // Tilt is a roll about the view axis, so it rotates the pair in screen
    // space rather than moving them on the sphere.
    const px = c[0] * cf * s, py = c[1] * cf * s;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const sx = ox + J.head[0] + px * ct - py * st;
    const sy = oy + J.head[1] + px * st + py * ct;

    // Squash along the radial direction as the eye rounds the sphere, and
    // fade the last sliver so it leaves rather than snaps off.
    const radial = Math.atan2(py * ct + px * st, px * ct - py * st);
    const r = (E.r ?? 0.17) * hr;
    out.push({
      z: J.head[3] + c[2] + 0.1,
      alpha: Math.min(1, (face - 0.12) / 0.18),
      draw(ctx) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(radial);
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.max(r * face, 0.01), Math.max(r * open, 0.01), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    });
  }
  return out;
}

// --- draw -----------------------------------------------------------------

export function draw(ctx, style, p, ox, oy) {
  const J = solve(style, p);
  const T = style.thick;
  const s = style.scale ?? 1;

  // Radius at a joint, shrunk by that joint's own perspective factor.
  const r = (joint, key) => T[key] * J[joint][2];

  const parts = [];
  const bone = (a, b, ka, kb) => parts.push({
    z: (J[a][3] + J[b][3]) / 2,
    draw: (c) => capsule(c, ox + J[a][0], oy + J[a][1], r(a, ka),
                            ox + J[b][0], oy + J[b][1], r(b, kb)),
  });
  const blob = (a, key) => parts.push({
    z: J[a][3],
    draw: (c) => dot(c, ox + J[a][0], oy + J[a][1], r(a, key)),
  });

  // A bar across the hips, so the thighs emerge from the ends of a wide pelvis
  // instead of flaring out of a narrow one. This is what finally kills the hip
  // flare at every angle rather than only head-on.
  bone('hipL', 'hipR', 'pelvis', 'pelvis');
  bone('pelvis', 'chestTop', 'pelvis', 'chest');
  bone('chestTop', 'head', 'chest', 'neck');

  bone('shoulderL', 'elbowL', 'armTop', 'elbow');
  bone('elbowL', 'wristL', 'elbow', 'wrist');
  blob('wristL', 'hand');
  bone('shoulderR', 'elbowR', 'armTop', 'elbow');
  bone('elbowR', 'wristR', 'elbow', 'wrist');
  blob('wristR', 'hand');

  bone('hipL', 'kneeL', 'thighTop', 'knee');
  bone('kneeL', 'ankleL', 'knee', 'ankle');
  bone('ankleL', 'toeL', 'ankle', 'toe');
  bone('hipR', 'kneeR', 'thighTop', 'knee');
  bone('kneeR', 'ankleR', 'knee', 'ankle');
  bone('ankleR', 'toeR', 'ankle', 'toe');

  blob('head', 'head');

  const eyes = eyeParts(style, p, J, ox, oy);

  // Painter's algorithm: far bones first. Everything is the same flat black,
  // so overlaps merge and only the outline of the union is ever seen.
  parts.sort((a, b) => a.z - b.z);
  ctx.fillStyle = style.ink;
  for (const part of parts) part.draw(ctx);

  // Eyes last, but only over the head — an arm crossing in front of his face
  // is drawn after them.
  const front = parts.filter((q) => q.z > J.head[3] + 0.1);
  ctx.fillStyle = style.eyeInk || '#fff';
  for (const e of eyes) {
    ctx.globalAlpha = e.alpha;
    e.draw(ctx);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = style.ink;
  for (const q of front) q.draw(ctx);
}
