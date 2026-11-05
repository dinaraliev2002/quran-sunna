"""Частые слова Корана → public/data/morph/freq.json
Считает по нашим данным: морфология (Quranic Arabic Corpus 0.4, app/morph-src) + русский пословный перевод (public/data/wbw).
Формат: {"total": слов в Коране, "w": [[лемма, корень, часть_речи, сколько_раз, перевод, пример «сура:аят:слово», «написание в примере»], …]}
 — по убыванию частоты. Часть речи: V глагол, N имя, P частица.
Запуск:  python -I scripts/build-freq.py
"""
import io, json, os, re
from collections import Counter, OrderedDict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'morph-src', 'quran-morphology.txt')
WBW = os.path.join(ROOT, 'public', 'data', 'wbw')
OUT = os.path.join(ROOT, 'public', 'data', 'morph', 'freq.json')
TOP = 1800

words = OrderedDict()
for line in io.open(SRC, encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) < 4: continue
    s, a, w, _ = (int(x) for x in p[0].split(':'))
    words.setdefault((s, a, w), []).append([p[1], p[2], p[3]])

wbw = {}
def tr_of(s, a, w):
    if s not in wbw:
        wbw[s] = json.load(io.open(os.path.join(WBW, f'{s:03d}.json'), encoding='utf-8'))
    rows = wbw[s]
    if a - 1 >= len(rows) or w - 1 >= len(rows[a - 1]): return ''
    return rows[a - 1][w - 1] or ''

def clean(t):
    t = re.sub(r'\([^)]*\)', '', t)
    return re.sub(r'^[\s,.;:!?«»—-]+|[\s,.;:!?«»—-]+$', '', t).strip()

lem = {}  # (лемма, корень, часть речи) -> [n, Counter(перевод), пример, написание]
for (s, a, w), segs in words.items():
    stem = next((g for g in segs if any(t.startswith('ROOT:') for t in g[2].split('|'))), None)
    if not stem:
        stem = next((g for g in segs if 'PREF' not in g[2].split('|')), segs[0])
    tags = stem[2].split('|')
    l = next((t[4:] for t in tags if t.startswith('LEM:')), None)
    if not l: continue
    root = next((t[5:] for t in tags if t.startswith('ROOT:')), '')
    key = (l, root, stem[1])
    e = lem.setdefault(key, [0, Counter(), f'{s}:{a}:{w}', ''.join(g[0] for g in segs), {}])
    e[0] += 1
    t = clean(tr_of(s, a, w))
    if t and len(t) < 40:
        e[1][t.lower()] += 1
        e[4].setdefault(t.lower(), (f'{s}:{a}:{w}', ''.join(g[0] for g in segs)))

rows = sorted(lem.items(), key=lambda kv: -kv[1][0])[:TOP]
def pick(v):
    # самый частый перевод и пример, где слово переведено именно так
    if not v[1]: return ('', v[2], v[3])
    t = v[1].most_common(1)[0][0]
    return (t, *v[4][t])
out = {'total': len(words), 'w': [[k[0], k[1], k[2], v[0], *pick(v)] for k, v in rows]}
with io.open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
cum = 0
for i, (k, v) in enumerate(rows):
    cum += v[0]
    if i + 1 in (10, 50, 100, 300, 1000): print(i + 1, 'слов покрывают', round(100 * cum / len(words), 1), '%')
print(os.path.getsize(OUT) // 1024, 'КБ')
