"""Разбор слов Корана (морфология) → public/data/morph/
Источник: Quranic Arabic Corpus, версия 0.4 (Kais Dukes, https://corpus.quran.com) — открытая копия
https://github.com/mustafa0x/quran-morphology (с исправленными леммами). Файл лежит в app/morph-src/ (в git не входит).
Условия корпуса: можно использовать в любом сайте или приложении, если ясно указан источник
(Quranic Arabic Corpus) и дана ссылка на corpus.quran.com.

  NNN.json    — {"<аят>": [слово, …]}, слово = [[написание, часть_речи, метки], …] (части слова: приставка, основа, суффикс)
  roots.json  — {"<корень>": {n: сколько слов, v: ["сура:аят", …] аяты с этим корнем,
                              f: [[написание слова, лемма, метки основы, сколько раз, ["сура:аят:слово", …до 4]], …]}}

Запуск:  python -I scripts/build-morph.py
"""
import io
import json
import os
import sys
from collections import Counter, OrderedDict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'morph-src', 'quran-morphology.txt')
OUT = os.path.join(ROOT, 'public', 'data', 'morph')
QURAN = os.path.join(ROOT, 'public', 'data', 'quran')


def dump(obj, path):
    with io.open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))


def main():
    words = OrderedDict()  # (сура, аят, слово) → список частей
    for line in io.open(SRC, encoding='utf-8'):
        p = line.rstrip('\n').split('\t')
        if len(p) < 4:
            continue
        s, a, w, _seg = (int(x) for x in p[0].split(':'))
        words.setdefault((s, a, w), []).append([p[1], p[2], p[3]])

    shutil_rm(OUT)
    os.makedirs(OUT, exist_ok=True)

    # файлы по сурам
    by_surah = {}
    for (s, a, w), segs in words.items():
        by_surah.setdefault(s, {}).setdefault(a, []).append(segs)
    bad = 0
    for s, ays in by_surah.items():
        q = json.load(io.open(os.path.join(QURAN, f'{s:03d}.json'), encoding='utf-8'))['ayahs']
        for a in q:
            have = len(ays.get(a['n'], []))
            if have != len(a['w']):
                bad += 1
        dump({str(a): v for a, v in ays.items()}, os.path.join(OUT, f'{s:03d}.json'))
    print(f'{len(words)} слов; аятов, где число слов не совпало с нашим текстом: {bad}')

    # корни: аяты и формы
    roots = {}
    for (s, a, w), segs in words.items():
        stem = next((g for g in segs if any(t.startswith('ROOT:') for t in g[2].split('|'))), None)
        if not stem:
            continue
        tags = stem[2].split('|')
        root = next(t[5:] for t in tags if t.startswith('ROOT:'))
        lem = next((t[4:] for t in tags if t.startswith('LEM:')), '')
        rest = '|'.join(t for t in tags if not t.startswith(('ROOT:', 'LEM:')))
        surface = ''.join(g[0] for g in segs)
        r = roots.setdefault(root, {'n': 0, 'v': [], 'f': {}})
        r['n'] += 1
        key = f'{s}:{a}'
        if not r['v'] or r['v'][-1] != key:
            r['v'].append(key)
        fk = (surface, lem, stem[1] + '|' + rest)
        f = r['f'].setdefault(fk, [0, []])
        f[0] += 1
        if len(f[1]) < 4:
            f[1].append(f'{s}:{a}:{w}')
    out = {}
    for root, r in roots.items():
        forms = sorted(([k[0], k[1], k[2], v[0], v[1]] for k, v in r['f'].items()), key=lambda x: -x[3])
        out[root] = {'n': r['n'], 'v': r['v'], 'f': forms}
    dump(out, os.path.join(OUT, 'roots.json'))
    size = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) // 1024
    print(f'{len(out)} корней -> public/data/morph/ ({size} КБ)')


def shutil_rm(path):
    if os.path.isdir(path):
        for fn in os.listdir(path):
            os.remove(os.path.join(path, fn))


if __name__ == '__main__':
    main()
