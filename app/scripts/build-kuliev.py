"""Комментарии к переводу Кулиева (раздел «Комментарии» издания Комплекса короля Фахда) → public/data/kuliev/

Источник: asbab-src не используется; текст распознан со скана и вычитан — app/kuliev-src/parsed/ (в git не входит).
  index.json         — для каждой суры: сколько аятов с комментариями, есть ли вступление; плюс список мест поклона
  NNN.json           — вступление суры и комментарии к аятам: {s, intro:[…], notes:{"аят":[[абзацы], …]}}
  glossary.json      — словарь арабских выражений и терминов
  sajda.json         — перечень мест для земных поклонов и мольба

Текст — авторский (Кулиев, издание Комплекса короля Фахда): показывать только в тестовой версии.
Запуск:  python scripts/build-kuliev.py --draft   — собрать для тестовой версии
         python scripts/build-kuliev.py           — убрать данные (для публичной версии)
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
    json.dump([{'ar': g['ar'], 'tr': g['term'], 'mean': g['mean']} for g in glossary],
              io.open(os.path.join(OUT, 'glossary.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(sajda, io.open(os.path.join(OUT, 'sajda.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    index['v'] = hashlib.md5(json.dumps(index, ensure_ascii=False).encode()).hexdigest()[:8]
    json.dump(index, io.open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    size = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) // 1024
    print(f"{len(comments)} сур, {sum(len(i['n']) for i in index['s'].values())} аятов с комментариями -> public/data/kuliev/ ({size} KB)")


main()
