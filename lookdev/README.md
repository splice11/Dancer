# Look-dev

Phase 0: pick the silhouette before anything is built on top of it.

Open `index.html` from a local server (`npx http-server -p 8099`) and it draws
a comparison sheet of four candidate builds across eight poses.

- `figure.js` — the rig and the renderer. Bones are drawn as tapered capsules
  (the convex hull of two circles), so joints blend seamlessly and the figure
  can hit any pose procedurally. **This file is the art style.**
- `styles.js` — the four candidate builds. Only thicknesses, head size, eye
  shape and bone lengths differ; the renderer is shared.
- `poses.js` — six poses from the reference sheet plus two lifted off the
  reference video.

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
