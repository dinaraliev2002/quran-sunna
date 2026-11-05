"""Темы Корана → public/data/topics.json
Источник: тематический указатель QUL (Quranic Universal Library, qul.tarteel.ai, «Ayah Topics», номер ресурса 45; в основе — тематический указатель
и онтология понятий Quranic Arabic Corpus). Файл topics.db лежит в app/morph-src/qul-topics/ (в git не входит).
Берём только «тематические» темы (дерево «Вероучение и жизнь» / «Истории» / «Невидимое»); раздел «Scientific references» не берём — это спорные толкования.
Русские названия — scripts/topics_ru.py.

  topics.json — список: {i: номер, p: номер родителя (0 — верхний уровень), ru: название, a: ["сура:аят", …] аяты темы}
Запуск:  python -I scripts/build-topics.py
"""
import io
import json
import os
import re
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from topics_ru import T  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DB = os.path.join(ROOT, 'morph-src', 'qul-topics', 'topics.db')
OUT = os.path.join(ROOT, 'public', 'data', 'topics.json')
SKIP_ROOT = 1940  # «Scientific refrences»


def ayahs(s):
    out = []
    for part in (s or '').split(','):
        m = re.match(r'^\s*(\d+):(\d+)(?:\s*-\s*(\d+))?\s*$', part)
        if not m:
            continue
        sura, a, b = int(m.group(1)), int(m.group(2)), int(m.group(3) or m.group(2))
        for x in range(a, min(b, a + 60) + 1):
            k = f'{sura}:{x}'
            if k not in out:
                out.append(k)
    return out


def main():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    rows = {r['topic_id']: dict(r) for r in c.execute('select * from topics where thematic = 1')}
    # исключаем раздел «Scientific references» и всё, что в нём
    def under(i, root):
        seen = 0
        while i and seen < 20:
            if i == root:
                return True
            i = (rows.get(i) or {}).get('thematic_parent_id')
            seen += 1
        return False

    out, missing = [], []
    for i, r in rows.items():
        if under(i, SKIP_ROOT):
            continue
        if i not in T:
            missing.append((i, r['name']))
            continue
        p = r['thematic_parent_id'] or 0
        if p and p not in rows:
            p = 0
        out.append({'i': i, 'p': p, 'ru': T[i], 'a': ayahs(r['ayahs'])})
    ids = {x['i'] for x in out}
    for x in out:
        if x['p'] not in ids:
            x['p'] = 0
    # пустые ветки (нет ни аятов, ни подтем) не нужны
    kids = {}
    for x in out:
        kids.setdefault(x['p'], []).append(x)
    def alive(x):
        return bool(x['a']) or any(alive(k) for k in kids.get(x['i'], []))
    out = [x for x in out if alive(x)]
    out.sort(key=lambda x: x['i'])
    with io.open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(out)} тем, {os.path.getsize(OUT) // 1024} КБ; без перевода: {len(missing)}')
    for i, n in missing:
        print('  нет перевода:', i, n.encode('ascii', 'replace').decode())


if __name__ == '__main__':
    main()
