"""Turn extracted pose data into a library of dance moves.

A move is a short sequence of target poses, one per beat. The rig's springs
generate everything between them, so there is no need to keep per-frame data —
which is lucky, because per-frame data from this footage is noisy.

Selection is deliberately greedy-farthest-point rather than clustering: the
point is a vocabulary of moves that look DIFFERENT from each other, not a set
of cluster centroids that all drift toward the average pose.
"""

import json, math, sys

LIMBS = ['armLU', 'armLF', 'armRU', 'armRF', 'legLU', 'legLF', 'legRU', 'legRF']
CHANNELS = [c for b in LIMBS for c in (b, b + 'Y')] + ['turn', 'headTurn', 'headPitch']

# Arms carry this dance; feet are the noisiest channel in the footage.
WEIGHT = {**{c: 1.0 for c in CHANNELS},
          **{c: 0.35 for c in ('legLF', 'legLFY', 'legRF', 'legRFY')},
          'headTurn': 0.4, 'headPitch': 0.4, 'turn': 0.7}


def ang_diff(a, b):
    d = (b - a) % 360
    return d - 360 if d > 180 else d


def dist(p, q):
    return math.sqrt(sum((WEIGHT[c] * ang_diff(p[c], q[c])) ** 2 for c in CHANNELS) / len(CHANNELS))


def pose_at(frames, t, who):
    """Nearest usable frame to a beat, and how trustworthy it is."""
    best, best_dt = None, 1e9
    for f in frames:
        if len(f['people']) <= who:
            continue
        dt = abs(f['t'] - t)
        if dt < best_dt:
            best_dt, best = dt, f['people'][who]
    if best is None or best_dt > 0.12:
        return None
    return best


def main(pose_path, beats_path, out_path, beats_per_move=4):
    data = json.load(open(pose_path))
    beats = json.load(open(beats_path))['beats']
    frames = data['frames']

    phrases = []
    for who in (0, 1):
        for start in range(0, len(beats) - beats_per_move):
            poses, vis = [], []
            for k in range(beats_per_move):
                p = pose_at(frames, beats[start + k], who)
                if p is None:
                    break
                poses.append({c: float(p.get(c, 0.0)) for c in CHANNELS})
                vis.append(p['vis'])
            if len(poses) < beats_per_move:
                continue
            motion = sum(dist(poses[i], poses[i + 1]) for i in range(len(poses) - 1))
            # How far the arms get from hanging (a hanging arm sits near +80
            # pitch). Big shapes are what survive being a flat silhouette, so
            # they earn their place in the library over small ones.
            lift = sum(max(0.0, 80 - q['armLU']) + max(0.0, 80 - q['armRU'])
                       for q in poses) / len(poses)
            phrases.append({'who': who, 't': beats[start], 'poses': poses,
                            'vis': sum(vis) / len(vis), 'motion': motion,
                            'lift': round(lift, 1)})

    # Keep the confident, actually-moving, big-shaped half.
    phrases.sort(key=lambda p: -(p['motion'] * p['vis'] * (1 + p['lift'] / 90)))
    pool = phrases[:max(12, len(phrases) // 2)]

    # Greedy farthest-point: each pick is the phrase least like everything
    # already chosen, so the library spreads across the vocabulary.
    def phrase_dist(a, b):
        return min(dist(x, y) for x in a['poses'] for y in b['poses'])

    picked = [pool[0]]
    while len(picked) < 14 and len(picked) < len(pool):
        best, best_d = None, -1
        for cand in pool:
            if cand in picked:
                continue
            d = min(phrase_dist(cand, p) for p in picked)
            if d > best_d:
                best_d, best = d, cand
        if best is None or best_d < 6:
            break
        picked.append(best)

    picked.sort(key=lambda p: p['t'])
    json.dump({'beats_per_move': beats_per_move,
               'source_bpm': json.load(open(beats_path))['bpm'],
               'moves': picked}, open(out_path, 'w'), indent=1)
    print(f'{len(phrases)} candidate phrases -> {len(picked)} distinct moves')
    for m in picked:
        print(f"  dancer {m['who']}  t={m['t']:6.2f}  motion {m['motion']:5.1f}  "
              f"lift {m['lift']:5.1f}  vis {m['vis']:.2f}")


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
