# Dancer

A stick figure who hangs around, hears music, and decides whether he feels
like dancing.

Runs in the browser. Open from a static server:

```sh
npx http-server -p 8099 -s .
```

- `app/index.html` — him, idling. Drag to walk around him; switch on watch
  cursor and he follows it with his eyes.
- `app/editor.html` — pose editor. Drag joints, drag elsewhere to orbit.
- `app/turntable.html` — every pose at eight body angles, for checking that a
  pose reads from more than the one camera it was authored at.
- `lookdev/index.html`, `lookdev/tune.html` — how the character was chosen.
  These render through a frozen copy of the 2D renderer that existed then.

## Layout

```
src/
  figure.js      the rig and the renderer — this file is the art style
  character.js   the settled character: proportions, weights, eyes
  poses.js       the pose library
  rig.js         damped-spring secondary motion
  idle.js        breathing, weight shift, blinking, glancing
app/             the pages you actually open
lookdev/         the look-dev and tuning sheets, kept as a record
```

## The skeleton is 3D; the renderer is not

Joints solve in his own space, turn about the vertical, project to the screen,
then draw as flat black capsules. That works because the art style has no
surface — no texture, no shading, no normals — so a capsule looks identical
from every angle. Almost all the cost of a 3D character lives in the surface he
does not have.

It also fixed a real problem rather than adding a feature. The old 2D rig could
not express a front view at all: shoulder separation was offset along screen-x,
which was also the facing axis, so there was only one lateral direction and the
far arm kept vanishing into the torso. In 3D, a front view separates the
shoulders across the screen and a side view separates them in depth, from the
same skeleton.

Each bone carries a pitch and a yaw (`<bone>Y`). Pitch swings it forward and
back, yaw swings it out to the side. `turn` is the whole body's yaw: 0 faces
the camera, 90 is the old side-on view.

His eyes are two discs riding the head sphere, placed by a direction rather
than a screen offset — so they foreshorten as he turns, slip round the side,
and come back. That is what lets him look at you, or away.

## How he is drawn

Every bone is filled as the convex hull of two circles — a tapered capsule.
Joints blend seamlessly because consecutive capsules share a circle, and the
caps are round for free. Nothing is a sprite, so he can hit any pose, which is
what makes free-form dancing possible at all.

Proportions were measured off the reference sheet rather than guessed: total
height is 3.0 head diameters, limb width 0.34 of head diameter.

He is a pure black fill with white eyes and nothing else. The eyes carry their
own colour rather than the page's, so he composites over any background.

## How he moves

Every bone angle is a damped spring chasing a target angle. Distal bones are
softer and less damped than the bones that drive them, so the shoulder arrives
first and the hand sails past and comes back — which is what the loose arm
whips in the reference video actually are.

Overshoot is `exp(-pi*z / sqrt(1 - z*z))`, set by the damping ratio alone; the
forearm's `z` of 0.46 gives it about 19% of its travel in follow-through.
Stiffness only sets how fast the move lands, and is tuned against the
reference track's 87 BPM pulse — a 0.69 s beat, with a move landing in about
0.55 s so the limb is still faintly moving when the next beat arrives.

The consequence worth knowing: **a dance move is just a target pose.** Set a
new target on the beat and the springs generate every frame between, including
the follow-through. Almost no keyframes needed.

## The hips

The old fix was narrow hips, which cost him separate-looking legs. In 3D the
renderer draws a bar between the two hip joints, so the thighs emerge from the
ends of a wide pelvis rather than flaring out of a narrow one — which holds at
every angle, not just head-on, and let the hips go back to a normal width.

## Projection lives in one place

`solve` applies perspective per joint, so anything that converts between screen
space and the rig has to agree with it. `groundOffset` and `aimBone` (the
editor's drag-to-angle inverse) live in `figure.js` for that reason. A page that
recomputes either one silently breaks when a bone changes — and canvas draws
nothing at all for `NaN` coordinates, with no error, so it breaks quietly.

## Reference material

The repository carries a reference image, a reference video and a music track.
They are development reference only, not licensed for redistribution — they
should come out of git before this goes anywhere public.
