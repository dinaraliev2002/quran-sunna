"""Разметка аятов в цельной записи суры по паузам, когда нет ни готовой разметки, ни файлов аятов (аль-Люхайдан).

Идея: между аятами чтец паузит. Находим все провалы звука (кандидаты в границы) и динамическим программированием
выбираем N-1 из них так, чтобы границы шли по порядку, предпочитали длинные паузы и держались около места,
где по числу букв должен кончаться аят. Граница ставится за 40 мс до того, как голос поднимется (как в refine-boundaries.py).

  python -I scripts/auto-ayah-marks.py <чтец> <суры: 55,67 | all> [--cache DIR] [--check]   (--check: сравнить с готовой разметкой)
"""
import json, os, re, sys, zlib
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
_spec = importlib.util.spec_from_file_location('refine_boundaries', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'refine-boundaries.py'))
rb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rb)
al = rb.al
DATA = os.path.join(al.ROOT, 'public', 'data')


def letters(t):
    t = re.sub(r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]', '', t)
    return len(re.findall(r'[\u0621-\u064A\u0671-\u06D3]', t))


def candidates(db, thr_db, min_ms):
    """Провалы: отрезки тишины не короче min_ms → (начало_тишины, конец_тишины)"""
    quiet = db < db.max() - thr_db
    out = []
    i, n = 0, len(quiet)
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]:
                j += 1
            if (j - i) * 10 >= min_ms:
                out.append((i * 10, j * 10))
            i = j
        else:
            i += 1
    return out


def mark(db, counts, basmala_first):
    """Границы аятов (мс начала каждого аята, первый — начало голоса)"""
    n = len(counts)
    voiced = np.nonzero(db > db.max() - 35)[0]
    t0, t1 = int(voiced[0]) * 10, (int(voiced[-1]) + 1) * 10
    cands = [c for c in candidates(db, 24, 120) if t0 + 500 < c[0] and c[1] < t1 - 300]
    if len(cands) < n - 1:
        cands = [c for c in candidates(db, 20, 60) if t0 + 500 < c[0] and c[1] < t1 - 300]
    cum = np.cumsum(counts) / sum(counts)
    # ожидаемое время конца k-го аята
    exp = [t0 + (t1 - t0) * cum[k] for k in range(n - 1)]
    m = len(cands)
    if m < n - 1:
        return None
    INF = 1e18
    # dp[k][c]: лучшая цена, если k-я граница (k=0..n-2) — кандидат c
    mid = [(a + b) / 2 for a, b in cands]
    ln = [b - a for a, b in cands]
    sc = lambda k, c: abs(mid[c] - exp[k]) / (t1 - t0) * 40 - min(ln[c], 1500) / 300
    dp = np.full((n - 1, m), INF)
    bp = np.zeros((n - 1, m), int)
    for c in range(m):
        dp[0][c] = sc(0, c)
    for k in range(1, n - 1):
        best, bi = INF, -1
        for c in range(m):
            if c - 1 >= 0 and dp[k - 1][c - 1] < best:
                best, bi = dp[k - 1][c - 1], c - 1
            if best < INF:
                dp[k][c] = best + sc(k, c)
                bp[k][c] = bi
    c = int(np.argmin(dp[n - 2]))
    idx = [c]
    for k in range(n - 2, 0, -1):
        c = int(bp[k][c])
        idx.append(c)
    idx.reverse()
    starts = [t0]
    for c in idx:
        b = rb.refine(db, cands[c][1])  # голос поднимается в конце тишины
        starts.append(b)
    return starts


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    cache = sys.argv[sys.argv.index('--cache') + 1] if '--cache' in sys.argv else 'D:/recite-cache'
    if '--cache' in sys.argv:
        args.remove(cache)
    rec, which = args[0], args[1]
    check = '--check' in sys.argv
    index = json.load(open(os.path.join(al.OUT, 'index.json'), encoding='utf-8'))
    surahs = range(1, 115) if which == 'all' else [int(x) for x in which.split(',')]
    errs = []
    for s in surahs:
        url = index[rec]['u'][s - 1]
        cands = [os.path.join(cache, rec, f'full{s:03d}-{zlib.crc32(url.encode())}.mp3'), os.path.join(cache, rec, f'w{s:03d}.mp3')]
        fp = next((c for c in cands if os.path.exists(c) and os.path.getsize(c) > 0), cands[0])
        os.makedirs(os.path.dirname(fp), exist_ok=True)
        full = al.load(url, fp)
        db = rb.energy_db(full)
        q = json.load(open(os.path.join(DATA, 'quran', f'{s:03d}.json'), encoding='utf-8'))['ayahs']
        counts = [letters(a['t']) for a in q]
        # в начале суры (кроме 1 и 9) идёт басмала — отдельный «аят» перед первым
        bas = s not in (1, 9)
        st = mark(db, ([19] if bas else []) + counts, False)
        if st is None:
            print(f'{rec} {s}: пауз меньше, чем аятов')
            continue
        if st is not None and bas:
            st = st[1:]
        if check:
            truth = json.load(open(os.path.join(al.OUT, rec, f'{s:03d}.json'), encoding='utf-8'))['a']
            d = [abs(st[i] - truth[i][0]) for i in range(1, min(len(st), len(truth)))]
            errs += d
            print(f'{rec} {s}: аятов {len(q)}, граница в среднем off {int(np.mean(d)) if d else 0} мс, >300 мс: {sum(1 for x in d if x > 300)}')
    if errs:
        e = sorted(errs)
        print(f'ИТОГО границ {len(e)}: медиана {e[len(e)//2]} мс, 90% {e[int(len(e)*.9)]} мс, >300мс {100*sum(1 for x in e if x>300)/len(e):.1f}%')


if __name__ == '__main__':
    main()
