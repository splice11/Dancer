# Look-dev

Phase 0: pick the silhouette before anything is built on top of it.

Open from a local server (`npx http-server -p 8099`):

- `index.html` — the first pass: four candidate builds across eight poses.
- `tune.html` — the fine-tuning pass around build C.

- `figure.js` — the rig and the renderer. Bones are drawn as tapered capsules
  (the convex hull of two circles), so joints blend seamlessly and the figure
  can hit any pose procedurally. **This file is the art style.**
- `styles.js` — the four candidate builds. Only thicknesses, head size, eye
  shape and bone lengths differ; the renderer is shared.
- `poses.js` — six poses from the reference sheet plus two lifted off the
  reference video.
- `variants.js` — the tuning variants around build C.

## The hip flare

The thighs reach `hipW/2 + thighTop` from the centreline; the pelvis reaches
only its own radius. The difference reads as wide hips.

Widening the torso does close the gap, but the arms hang close to the body at
rest, so a pelvis much past 22 swallows them and the silhouette goes
barrel-shaped. Narrowing the hips costs nothing and still leaves the legs
parting well short of a single point. The settled fix is
`hipW 11, pelvis 19.5, thighTop 15.5`, which drops the flare from 13 to 1.5.

## Colour

He is a pure black fill (`#000`) with white eyes (`#fff`) and nothing else.
The eyes carry their own colour rather than the paper colour, so he composites
over any background — which matters for the transparent-window desktop build
later.

## Proportions

Measured off `file_000000001cec8210a40e48d80c214871.png` by thresholding the
ink and taking the longest contiguous horizontal run per row:

- total height = **3.0 head diameters**
- limb width = **0.34 head diameters**

Build A reproduces those numbers. B, C and D deliberately depart from them.

## Bone angles are absolute, not relative

Every angle in a pose is world-space (-90 is straight up). That is exactly
what 2D pose estimation returns, so retargeting mocap from the reference
video later is a direct assignment rather than a conversion.
