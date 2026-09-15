"""Find the beat grid of an audio file.

Spectral flux for the onset envelope, autocorrelation for the tempo, then a
pulse train slid across the envelope to find the phase. Enough for driving a
dancer, and about forty lines instead of a dependency.

The tempo search deliberately reports the half and double too: the reference
track autocorrelates just as strongly at 174 as at 87, and a dancer moving on
174 looks frantic. Which one to dance on is a judgement the caller makes.
"""

import json, subprocess, sys
import numpy as np

SR = 22050
HOP = 256
WIN = 1024


def envelope(path, ffmpeg):
    raw = subprocess.run(
        [ffmpeg, '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
        capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    frames = np.lib.stride_tricks.sliding_window_view(x, WIN)[::HOP] * np.hanning(WIN)
    mag = np.abs(np.fft.rfft(frames, axis=1))
    flux = np.diff(mag, axis=0)
    flux[flux < 0] = 0                      # onsets only: energy appearing
    env = flux.sum(1)
    return env - env.mean(), len(x) / SR


def tempo(env, lo=60, hi=200):
    ac = np.correlate(env, env, 'full')[len(env) - 1:]
    ac /= ac[0]
    fps = SR / HOP
    cands = []
    for bpm in np.arange(lo, hi, 0.25):
        i = int(round(fps * 60 / bpm))
        if 2 * i < len(ac):
            cands.append((ac[i] + 0.5 * ac[2 * i], bpm, float(ac[i])))
    cands.sort(reverse=True)
    return cands[0][1], cands[:1] + [c for c in cands if abs(c[1] / cands[0][1] - 2) < .02
                                     or abs(c[1] / cands[0][1] - .5) < .02][:2]


def grid(env, bpm, duration):
    """Slide a pulse train to find where the beats actually land."""
    fps = SR / HOP
    period = fps * 60 / bpm
    best, best_score = 0, -1e18
    for off in np.arange(0, period, 0.5):
        idx = np.arange(off, len(env), period).astype(int)
        idx = idx[idx < len(env)]
        score = env[idx].sum()
        if score > best_score:
            best_score, best = score, off
    times = np.arange(best, len(env), period) / fps
    return [round(float(t), 3) for t in times if t < duration]


def main(path, out, ffmpeg):
    env, duration = envelope(path, ffmpeg)
    bpm, cands = tempo(env)
    beats = grid(env, bpm, duration)
    json.dump({'bpm': round(float(bpm), 2), 'duration': round(duration, 2),
               'candidates': [{'bpm': round(float(b), 2), 'strength': round(s, 3)}
                              for _, b, s in cands],
               'beats': beats}, open(out, 'w'))
    print(f'{duration:.1f}s | tempo {bpm:.2f} BPM | {len(beats)} beats')
    print('also strong at: ' + ', '.join(f'{b:.1f} ({s:.2f})' for _, b, s in cands[1:]))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
