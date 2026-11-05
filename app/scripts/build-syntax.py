"""Роль слова в предложении (ирааб) → public/data/syntax/
Источник: The Quranic Treebank (NoorBayan/Quranic, github.com/NoorBayan/Quranic, лицензия MIT; строится на морфологии Quranic Arabic Corpus).
Файл Quranic.csv (UTF-16, табуляция) лежит в app/morph-src/noorbayan-rar/ (в git не входит; берётся из Quranic.rar репозитория).

  labels.json — арабские названия ролей (номер = место в списке)
  NNN.json    — {"<аят>": [слово, …]}; слово = [[роль, слово-вершина, аят-вершины, часть_слова], …]
                слово-вершина: номер слова; 0 — вершина всего предложения; -1 — подразумеваемое слово (в тексте его нет)
                аят-вершины: 0 — тот же аят, иначе номер аята
Запуск:  python -I scripts/build-syntax.py
"""
import csv
import io
import json
import os
import re
import shutil
from collections import Counter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'morph-src', 'noorbayan-rar', 'Quranic.csv')
LICENSE = os.path.join(ROOT, 'morph-src', 'noorbayan-LICENSE')
OUT = os.path.join(ROOT, 'public', 'data', 'syntax')
LOC = re.compile(r'^\((\d+):(\d+):(\d+):(\d+)\)$')


def main():
    rows = list(csv.DictReader(io.open(SRC, encoding='utf-16', newline=''), delimiter='\t'))
    # вершина указана номером части внутри предложения (а предложение может идти через несколько аятов)
    by_tid = {(r['sentence_id'], r['token_id']): r for r in rows}
    labels = []
    index = {}

    def label_id(ar):
        if ar not in index:
            index[ar] = len(labels)
            labels.append(ar)
        return index[ar]

    surahs = {}
    skipped = Counter()
    for r in rows:
        m = LOC.match(r['location'])
        if not m:
            continue  # подразумеваемое слово «(*)»
        s, a, w, t = (int(x) for x in m.groups())
        ar = r['rel_label_ar'].strip()
        if ar in ('NonRel', '_', ''):
            skipped[ar] += 1
            continue
        head = by_tid.get((r['sentence_id'], r['ref_token_id']))
        if ar == 'root':
            hw, ha = 0, 0
        else:
            hm = LOC.match(head['location']) if head else None
            if not hm:
                hw, ha = -1, 0
            else:
                hs, hay, hww, _ = (int(x) for x in hm.groups())
                hw, ha = hww, (0 if hay == a else hay)
                if hs != s:
                    hw, ha = -1, 0
        words = surahs.setdefault(s, {}).setdefault(a, {})
        words.setdefault(w, []).append([label_id(ar), hw, ha, t])

    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    for s, ays in surahs.items():
        data = {}
        for a, ws in ays.items():
            n = max(ws)
            data[str(a)] = [ws.get(i, []) for i in range(1, n + 1)]
        with io.open(os.path.join(OUT, f'{s:03d}.json'), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    with io.open(os.path.join(OUT, 'labels.json'), 'w', encoding='utf-8') as f:
        json.dump(labels, f, ensure_ascii=False, separators=(',', ':'))
    shutil.copy(LICENSE, os.path.join(OUT, 'LICENSE-NoorBayan.txt'))
    size = sum(os.path.getsize(os.path.join(OUT, fn)) for fn in os.listdir(OUT)) // 1024
    print(f'{len(surahs)} сур, {len(labels)} ролей, {size} КБ; пропущено: {dict(skipped)}')


if __name__ == '__main__':
    main()
