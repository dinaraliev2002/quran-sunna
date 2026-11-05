"""Комментарии к переводу Кулиева (раздел «Комментарии» издания Комплекса короля Фахда) → public/data/kuliev/

Источник: asbab-src не используется; текст распознан со скана и вычитан — app/kuliev-src/parsed/ (в git не входит).
  index.json         — для каждой суры: сколько аятов с комментариями, есть ли вступление; плюс список мест поклона
  NNN.json           — вступление суры и комментарии к аятам: {s, intro:[…], notes:{"аят":[[абзацы], …]}}
  glossary.json      — словарь арабских выражений и терминов
  sajda.json         — перечень мест для земных поклонов и мольба

Текст — авторский (Кулиев, издание Комплекса короля Фахда): показывать только в тестовой версии.
Запуск:  python scripts/build-kuliev.py --draft   — собрать для тестовой версии
         python scripts/build-kuliev.py           — убрать данные (для публичной версии)
         python scripts/build-kuliev.py --draft --out store-data/kuliev   — для приложений в магазинах
"""
import hashlib
import io
import json
import os
import shutil
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'kuliev-src', 'parsed')
OUT = os.path.join(ROOT, 'public', 'data', 'kuliev')
if '--out' in sys.argv:
    OUT = os.path.abspath(os.path.join(ROOT, sys.argv[sys.argv.index('--out') + 1]))


# Падежные окончания, с которыми термин может встретиться в русском тексте перевода
ENDINGS = '(?:а|у|е|ом|ы|и|ов|ам|ами|ах|я|ю|ем|ей|ь)?'
HIT_LIMIT = 60  # сколько аятов с термином хранить для показа (остальные — только счётчик)


def glossary_hits(terms):
    """Для каждого термина — в каких аятах он встречается в русском переводе: (сколько, первые HIT_LIMIT «сура:аят»)"""
    import glob
    import re
    texts = []
    for fn in sorted(glob.glob(os.path.join(ROOT, 'public', 'data', 'quran', '*.json'))):
        d = json.load(io.open(fn, encoding='utf-8'))
        for a in d['ayahs']:
            texts.append((f"{d['id']}:{a['n']}", (a['ku'] + ' ' + a['aa']).replace('ё', 'е').replace('Ё', 'Е')))
    out = []
    for t in terms:
        name = re.sub(r'\(.*?\)', '', t['term']).strip().replace('ё', 'е')
        name = re.sub(r'^(Аль|Ал|Ар|Ас|Ат|Ан|Ад|Аш|Аз)[- ]', '', name)
        stem = name[:-1] if len(name) > 4 and name[-1] in 'аяьйыи' else name
        # очень короткие слова («Ад», «Нар») ищем с учётом заглавной буквы — иначе совпадут с обычными словами
        short = len(stem) <= 3
        rx = re.compile(r'(?<![А-Яа-я])' + re.escape(stem) + ('' if short else ENDINGS) + r'(?![А-Яа-я])', 0 if short else re.I)
        hits = [k for k, txt in texts if rx.search(txt)]
        if short and len(hits) > 40:
            hits = []  # слишком общее слово («Ад» — и народ, и преисподняя): число было бы неверным
        out.append((len(hits), hits[:HIT_LIMIT]))
    return out


def load(name):
    return json.load(io.open(os.path.join(SRC, name), encoding='utf-8'))


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    if '--draft' not in sys.argv:
        print('данные Кулиева убраны из public/data/kuliev (публичная сборка)')
        return
    os.makedirs(OUT, exist_ok=True)
    comments, glossary, sajda = load('comments.json'), load('glossary.json'), load('sajda.json')
    index = {'s': {}, 'sajda': [[p['surah'], p['ayah']] for p in sajda['places']]}
    for c in comments:
        notes = {}
        for n in c['notes']:
            notes.setdefault(str(n['ayah']), []).append(n['text'])
        data = {'s': c['surah'], 'intro': c['intro'], 'notes': notes}
        json.dump(data, io.open(os.path.join(OUT, f"{c['surah']:03d}.json"), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        index['s'][str(c['surah'])] = {'n': sorted(int(a) for a in notes), 'intro': bool(c['intro'])}
    hits = glossary_hits(glossary)
    json.dump([{'ar': g['ar'], 'tr': g['term'], 'mean': g['mean'], **({'n': n, 'h': h} if n else {})} for g, (n, h) in zip(glossary, hits)],
              io.open(os.path.join(OUT, 'glossary.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(sajda, io.open(os.path.join(OUT, 'sajda.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    index['v'] = hashlib.md5(json.dumps(index, ensure_ascii=False).encode()).hexdigest()[:8]
    json.dump(index, io.open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    size = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) // 1024
    print(f"{len(comments)} сур, {sum(len(i['n']) for i in index['s'].values())} аятов с комментариями -> {os.path.relpath(OUT, ROOT)} ({size} KB)")


main()
