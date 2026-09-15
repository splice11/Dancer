# Pipeline

Turning the reference video into the move library. Each step writes a file the
next one reads, so any of them can be re-run alone.

```sh
# 1. Bone angles, per frame, for both dancers.
pip install mediapipe opencv-contrib-python numpy
curl -sSL -o pose_heavy.task \
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task
python3 tools/extract_pose.py <video> pose_heavy.task pose.json

# 2. Where the beats are.
python3 tools/beats.py <video> beats.json <ffmpeg>

# 3. Phrases of four beats, deduped into a vocabulary.
python3 tools/build_moves.py pose.json beats.json moves_raw.json

# 4. Make them legible as silhouettes, and write src/moves.js.
node tools/declutter.mjs moves_raw.json
```

`mediapipe` needs `libegl1` and `libgles2` present, even headless.

## Things that were not obvious

**The body frame has to match the rig's.** MediaPipe world landmarks are
camera-aligned, so every bone is measured inside a frame built from the
shoulders and hips. The rig puts `shoulderL` at negative local x, so local +x
is his RIGHT. Building that frame around his left instead mirrors every yaw,
and the result looks plausible enough to miss — arms move, they are just all
on the wrong side.

**The spine cannot be measured this way.** It is the body frame's own up axis,
so measuring it against that frame is circular and always returns -90 with a
meaningless yaw. The rig keeps the spine upright and lets `turn` carry the
torso.

**Tempo detection needs a human.** The reference video autocorrelates at 66.5
and 133; the target track at 88 and 175. Both are real. Which one to dance on
is a judgement, so `beats.py` reports the alternatives instead of picking.

**Only the beat poses survive.** The springs generate every frame between
targets, so the library stores four poses per move and no per-frame data. That
is also why a move captured at 133 BPM replays correctly at 88 — it is a
sequence of shapes, not a recording.

## Verifying a retarget

Render the rig from the extracted angles and stack it under the matching video
frames. Nothing else catches a mirrored axis: the numbers all look reasonable,
and only the picture shows the arms are on the wrong side.
