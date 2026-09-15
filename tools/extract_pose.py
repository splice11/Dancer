"""Pull bone angles for the rig out of the reference video.

MediaPipe gives world landmarks in metres. Those are camera-aligned, so the
first job is to build a body frame from the shoulders and hips and express
every bone inside it — that way a bone angle means the same thing whichever
way the dancer happens to be facing, which is exactly what the rig stores.

Two dancers are in frame throughout, so both are tracked and kept apart by
horizontal position.
"""

import json, math, sys
import numpy as np
import cv2
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

L = {  # the landmark indices we actually use
    'nose': 0, 'ear_l': 7, 'ear_r': 8,
    'sh_l': 11, 'sh_r': 12, 'el_l': 13, 'el_r': 14, 'wr_l': 15, 'wr_r': 16,
    'hip_l': 23, 'hip_r': 24, 'kn_l': 25, 'kn_r': 26, 'an_l': 27, 'an_r': 28,
}

# rig channel -> (from, to) landmark pair
BONES = {
    'armLU': ('sh_l', 'el_l'), 'armLF': ('el_l', 'wr_l'),
    'armRU': ('sh_r', 'el_r'), 'armRF': ('el_r', 'wr_r'),
    'legLU': ('hip_l', 'kn_l'), 'legLF': ('kn_l', 'an_l'),
    'legRU': ('hip_r', 'kn_r'), 'legRF': ('kn_r', 'an_r'),
}


def unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else np.array([0.0, 0.0, 0.0])


def body_frame(p):
    """His right, his down, his forward — matching the rig's own axes.

    The rig puts shoulderL at negative local x, so local +x is his RIGHT, not
    his left. Building the frame the other way round mirrors every yaw.
    """
    hip_c = (p['hip_l'] + p['hip_r']) / 2
    sh_c = (p['sh_l'] + p['sh_r']) / 2
    down = unit(hip_c - sh_c)                 # world y grows downward
    right = unit(p['sh_r'] - p['sh_l'])
    right = unit(right - down * np.dot(right, down))   # orthogonalise
    # right x down = forward, the same handedness boneDir() assumes.
    fwd = unit(np.cross(right, down))
    return right, down, fwd, hip_c, sh_c


def angles(d, right, down, fwd):
    """A bone direction, as the rig's pitch and yaw."""
    lx, ly, lz = np.dot(d, right), np.dot(d, down), np.dot(d, fwd)
    pitch = math.degrees(math.asin(max(-1.0, min(1.0, ly))))
    yaw = math.degrees(math.atan2(lx, lz))
    return round(pitch, 1), round(yaw, 1)


def main(video, model, out, max_frames=None):
    opts = vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model),
        running_mode=vision.RunningMode.VIDEO,
        num_poses=2,
        min_pose_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    cap = cv2.VideoCapture(video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frames = []

    with vision.PoseLandmarker.create_from_options(opts) as lm:
        i = 0
        while True:
            ok, bgr = cap.read()
            if not ok or (max_frames and i >= max_frames):
                break
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            res = lm.detect_for_video(img, int(i * 1000 / fps))

            people = []
            for k, world in enumerate(res.pose_world_landmarks or []):
                img_lm = res.pose_landmarks[k]
                p = {name: np.array([world[j].x, world[j].y, world[j].z])
                     for name, j in L.items()}
                # Screen x of the hips: what keeps the two dancers apart.
                screen_x = (img_lm[L['hip_l']].x + img_lm[L['hip_r']].x) / 2
                vis = float(np.mean([img_lm[j].visibility for j in L.values()]))

                right, down, fwd, hip_c, sh_c = body_frame(p)
                rec = {'x': round(screen_x, 4), 'vis': round(vis, 3)}

                # Body turn: 0 faces the camera. The camera looks along -z in
                # MediaPipe world space, so his forward is compared against that.
                rec['turn'] = round(math.degrees(math.atan2(fwd[0], -fwd[2])), 1)

                # The spine is the body frame's own up axis, so measuring it
                # against that frame is circular — it always returns -90 with
                # a meaningless yaw. The rig keeps it upright and lets `turn`
                # carry the torso's orientation.
                rec['spine'], rec['spineY'] = -90.0, 0.0

                # Head: where the face points relative to the body, which is
                # what the rig's headTurn and headPitch want.
                ear_c = (p['ear_l'] + p['ear_r']) / 2
                face = unit(p['nose'] - ear_c)
                fx, fy, fz = np.dot(face, right), np.dot(face, down), np.dot(face, fwd)
                rec['headTurn'] = round(math.degrees(math.atan2(fx, fz)), 1)
                rec['headPitch'] = round(-math.degrees(math.asin(max(-1.0, min(1.0, fy)))), 1)

                for ch, (a, b) in BONES.items():
                    pi, ya = angles(unit(p[b] - p[a]), right, down, fwd)
                    rec[ch], rec[ch + 'Y'] = pi, ya
                people.append(rec)

            people.sort(key=lambda r: r['x'])
            frames.append({'t': round(i / fps, 3), 'people': people})
            i += 1

    cap.release()
    json.dump({'fps': fps, 'frames': frames}, open(out, 'w'))
    both = sum(1 for f in frames if len(f['people']) == 2)
    print(f'{len(frames)} frames at {fps:.2f} fps -> {out}')
    print(f'both dancers found in {both} frames ({both/max(len(frames),1)*100:.0f}%)')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3],
         int(sys.argv[4]) if len(sys.argv) > 4 else None)
