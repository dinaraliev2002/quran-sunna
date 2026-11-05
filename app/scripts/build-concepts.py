"""Понятия Корана (люди, места, существа, растения, предметы) → public/data/concepts.json
Источник: онтология понятий Quranic Arabic Corpus (corpus.quran.com), страницы скачаны scripts/fetch-qac-ontology.py в app/morph-src/qac-ontology/.
Русские названия — scripts/concepts_ru.py (и пересказ описаний — scripts/concepts_desc_ru.py, если он есть).

  concepts.json — список: {i: номер в корпусе, ar: арабское, ru: русское название, en: английское, c: [путь категорий],
                           d: описание (по-русски, если переведено), v: ["сура:аят", …] где упоминается, n: сколько всего слов-упоминаний}
Запуск:  python -I scripts/build-concepts.py
"""
import html
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from concepts_ru import NAMES  # noqa: E402

try:
    from concepts_desc_ru import DESC  # noqa: E402
except ImportError:
    DESC = {}
try:
    from concepts_cat_ru import CATS  # noqa: E402
except ImportError:
    CATS = {}

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CACHE = os.path.join(ROOT, 'morph-src', 'qac-ontology')
OUT = os.path.join(ROOT, 'public', 'data', 'concepts.json')


# общая категория для фильтра: по самому длинному подходящему признаку в пути («Prophet», «City»…)
_CAT = [
    ('Prophet', 'Пророки и посланники'), ('Messenger', 'Пророки и посланники'), ('Quraysh', 'Люди и народы'), ('Historic', 'Люди и народы'),
    ('Angel', 'Ангелы'), ('Jinn', 'Джинны'), ('Human', 'Люди и народы'), ('Sentient', 'Люди и народы'),
    ('Animal', 'Животные'), ('Insect', 'Животные'), ('Bird', 'Животные'), ('Plant', 'Растения'), ('Biological', 'Животные'),
    ('Body Part', 'Тело человека'), ('Disease', 'Тело человека'), ('Food', 'Еда'), ('Afterlife Location', 'Последняя жизнь'),
    ('Afterlife Event', 'Последняя жизнь'), ('Place of Worship', 'Места поклонения'), ('Location', 'Места'), ('False Deity', 'Ложные божества'),
    ('Weaponary', 'Предметы'), ('Artifact', 'Предметы'), ('Physical Substance', 'Вещества'), ('Astronomical', 'Небесные тела'),
    ('Event', 'События и дни'), ('Religion', 'Религии и книги'), ('Holy Book', 'Религии и книги'), ('Weather', 'Явления природы'),
]


def category(path):
    j = ' > '.join(path)
    for key, ru in _CAT:
        if key in j:
            return ru
    return 'Другое'


def read(name):
    p = os.path.join(CACHE, name)
    return io.open(p, encoding='utf-8').read() if os.path.exists(p) else None


def text(s):
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', s))).strip()


def main():
    top = read('topics.html')
    ids = sorted(set(re.findall(r'concept\.jsp\?id=([^"&]+)"', top)))
    out, missing = [], []
    for cid in ids:
        key = re.sub(r'[^a-z0-9-]', '_', cid)
        page = read(f'c_{key}.html')
        if not page:
            missing.append(cid)
            continue
        m = re.search(r'<td class="documentation">\s*<p class="first">(.*?)</p>', page, re.S)
        desc = text(m.group(1)).split(' This concept is part of')[0] if m else ''
        name = re.search(r'<td colspan="2" class="name">(.*?)</td>', page, re.S)
        ar = re.search(r'<td colspan="2" class="arabic">(.*?)</td>', page, re.S)
        hier = re.search(r'<table[^>]*class="hierarchyTable">(.*?)</table>', page, re.S)
        cats = [text(x) for x in re.findall(r'<a href="/concept\.jsp\?id=[^"]*">(.*?)</a>', hier.group(1))] if hier else []
        # цепочка категорий без корня «Concept» и без самого понятия
        path = [c for c in cats if c.lower() != 'concept'][:-1]
        verses, words, p = [], 0, 1
        while True:
            sp = read(f's_{key}_{p}.html')
            if sp is None:
                break
            if p == 1:
                t = re.search(r'Results <b>\d+</b> to <b>\d+</b> of <b>(\d+)</b>', sp)
                words = int(t.group(1)) if t else 0
            for s_, a_ in re.findall(r'\((\d+):(\d+):\d+\)', sp):
                k = f'{s_}:{a_}'
                if k not in verses:
                    verses.append(k)
            p += 1
        if not verses:
            continue  # общее название-категория без собственных аятов (например, «Ангелы»: аяты есть у Джибриля, Микаиля…)
        out.append({
            'i': cid, 'ar': text(ar.group(1)) if ar else '', 'ru': NAMES.get(cid) or (text(name.group(1)) if name else cid),
            'en': text(name.group(1)) if name else cid, 'c': [category(path)], 'd': DESC.get(cid, ''),
            'v': verses, 'n': words,
        })
    out.sort(key=lambda x: x['ru'].lower())
    with io.open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(out)} понятий, не докачано {len(missing)}; {os.path.getsize(OUT) // 1024} КБ')


if __name__ == '__main__':
    main()
