"""
Сборка «Историй аятов» (асбаб ан-нузуль — причины ниспослания) → public/data/asbab/
  index.json — книги и какие аяты каких сур имеют истории; NNN.json — истории суры NNN

Источники лежат в app/asbab-src/ (в git не попадают, пока нет разрешения правообладателей):
  raw/b_<id>/           — страницы книг из библиотеки «Шамиля» (shamela.ws/book/<id>)
  <книга>/entries.json  — книга, разобранная по аятам (арабский текст, сура, аяты, страница)
  <книга>/ru/*.json     — русский перевод записей (файлы по группам сур): [{id, title, verdict, parts: [{k, t}]}]
                          k: src — где передано, isnad — цепочка передатчиков, text — само предание,
                             note — разбор автора, foot — сноска

Запуск:  python scripts/build-asbab.py
"""
import json
import os
import re

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'asbab-src')
OUT = os.path.join(ROOT, 'public', 'data', 'asbab')

BOOKS = {
    'wadii': {
        'author': 'Мукбиль ибн Хади аль-Вадии',
        'title': 'ас-Сахих аль-муснад мин асбаб ан-нузуль',
        'about': 'Достоверное с цепочками передатчиков о причинах ниспослания аятов. '
                 'Автор приводит только то, что считает достоверным или хорошим, и разбирает цепочки.',
        'edition': 'Каир, «Мактабат Ибн Таймия», 4-е изд., 1987',
    },
}


def main():
    out = {'books': BOOKS, 's': {}}
    total = 0
    for book in BOOKS:
        entries = {e['id']: e for e in json.load(open(os.path.join(SRC, book, 'entries.json'), encoding='utf-8'))}
        rudir = os.path.join(SRC, book, 'ru')
        for fn in sorted(os.listdir(rudir)):
            for r in json.load(open(os.path.join(rudir, fn), encoding='utf-8')):
                e = entries[r['id']]
                m = re.match(r'\[ص(\d+)\]', e['ar'])
                out['s'].setdefault(str(e['s']), []).append({
                    'id': r['id'], 'book': book, 'from': e['from'], 'to': e['to'],
                    'page': m.group(1) if m else None,
                    'title': r['title'], 'verdict': r.get('verdict'), 'parts': r['parts'],
                })
                total += 1
    for lst in out['s'].values():
        lst.sort(key=lambda x: (x['from'], x['id']))
    if os.path.isdir(OUT):
        for fn in os.listdir(OUT): os.remove(os.path.join(OUT, fn))
    os.makedirs(OUT, exist_ok=True)
    index = {'books': BOOKS, 's': {}}
    for s, lst in out['s'].items():
        index['s'][s] = sorted({(x['from'], x['to']) for x in lst})
        json.dump(lst, open(os.path.join(OUT, f'{int(s):03d}.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(index, open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    size = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) // 1024
    print(f'{total} stories, {len(out["s"])} surahs -> public/data/asbab/ ({size} KB)')


if __name__ == '__main__':
    main()
