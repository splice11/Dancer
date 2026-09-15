# Dancer

A stick figure who hangs around, hears music, and decides whether he feels
like dancing.

Runs in the browser. Open from a static server:

```sh
npx http-server -p 8099 -s .
```

- `app/index.html` — him, idling. Fire a pose and watch the follow-through.
- `app/editor.html` — pose editor. Drag joints, copy the pose out.
- `lookdev/index.html`, `lookdev/tune.html` — how the character was chosen.

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

## Known compromise

His hips are narrow, which is what stopped them reading wide. The cost is that
his legs sit close together and read as one column with a seam rather than two
clearly separate legs. Widening the torso instead fixes the legs but swallows
the arms, so this was the better trade.

## Reference material

The repository carries a reference image, a reference video and a music track.
They are development reference only, not licensed for redistribution — they
should come out of git before this goes anywhere public.
