"""
Сборка «Историй аятов» (асбаб ан-нузуль — причины ниспослания) → public/data/asbab/
  index.json — книги и какие аяты каких сур имеют истории; NNN.json — карточки историй суры NNN

Источники лежат в app/asbab-src/ (в git не попадают, пока нет разрешения правообладателей):
  raw/b_<id>/           — страницы книг из библиотеки «Шамиля» (shamela.ws/book/<id>)
  <книга>/entries.json  — книга, разобранная по записям (арабский текст, сура, аяты, страница)
  <книга>/ru/*.json     — русский перевод записей: [{id, title, verdict, parts: [{k, t}], link?, sabab?}]
                          k: src — где передано, isnad — цепочка передатчиков, text — само предание,
                             note — разбор автора, result — итог автора, foot — сноска
                          link — id записей главной книги (аль-Вадии) о той же истории;
                          sabab — вывод автора: yes (это причина), no (нет), other (причина — другое), weak

Карточка = одна история. Если та же история есть в нескольких книгах — она показывается один раз,
а мнения книг собраны в «opinions». Главная книга (первая в BOOKS) даёт текст карточки.

Запуск:  python scripts/build-asbab.py
"""
import hashlib
import json
import os
import re

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'asbab-src')
OUT = os.path.join(ROOT, 'public', 'data', 'asbab')

BOOKS = {
    'wadii': {
        'author': 'Мукбиль ибн Хади аль-Вадии',
        'short': 'аль-Вадии',
        'title': 'ас-Сахих аль-муснад мин асбаб ан-нузуль',
        'about': 'Достоверное с цепочками передатчиков о причинах ниспослания аятов. '
                 'Автор приводит только то, что считает достоверным или хорошим, и разбирает цепочки.',
        'edition': 'Каир, «Мактабат Ибн Таймия», 4-е изд., 1987',
    },
    'muharrar': {
        'author': 'Халид ибн Сулейман аль-Музайни',
        'short': 'аль-Музайни',
        'title': 'аль-Мухаррар фи асбаб нузуль аль-Куран',
        'about': 'Исследование причин ниспослания по девяти главным сборникам хадисов: автор проверяет и '
                 'достоверность предания, и то, действительно ли это причина ниспослания.',
        'edition': 'Даммам, «Дар Ибн аль-Джаузи», 1-е изд., 2006',
    },
    'wahidi': {
        'author': 'Абу аль-Хасан ‘Али ибн Ахмад аль-Вахиди',
        'short': 'аль-Вахиди',
        'title': 'Асбаб нузуль аль-Куран',
        'about': 'Одна из первых книг о причинах ниспослания (V век хиджры). Автор собирает всё, что передано, '
                 'не отделяя достоверное от слабого, поэтому к каждому преданию приведена оценка исследователя '
                 'Исама аль-Хумайдана. Цепочки самого аль-Вахиди до известных передатчиков сокращены.',
        'edition': 'Даммам, «Дар аль-Ислах», 2-е изд., 1992, исследование ‘Исама ибн ‘Абд аль-Мухсина аль-Хумайдана',
    },
}


def page_of(book, e):
    if book == 'wadii':
        m = re.match(r'\[ص(\d+)\]', e['ar'])
        return m.group(1) if m else None
    return e.get('page')


def load(book):
    entries = {e['id']: e for e in json.load(open(os.path.join(SRC, book, 'entries.json'), encoding='utf-8'))}
    rudir = os.path.join(SRC, book, 'ru')
    items = []
    if not os.path.isdir(rudir):
        return items
    for fn in sorted(os.listdir(rudir)):
        for r in json.load(open(os.path.join(rudir, fn), encoding='utf-8')):
            # одна запись книги может быть разделена на несколько историй: h033, h033b…
            e = entries.get(r['id']) or entries[re.sub('[b-z]$', '', r['id'])]
            items.append({
                'id': r['id'], 'book': book, 'page': page_of(book, e),
                'refs': e.get('refs') or [[e['s'], e['from'], e['to']]],
                'title': r['title'], 'verdict': r.get('verdict'), 'sabab': r.get('sabab'),
                'link': r.get('link') or [], 'parts': r['parts'],
            })
    return items


def opinion(x):
    return {k: x[k] for k in ('id', 'book', 'page', 'title', 'verdict', 'sabab', 'parts') if x.get(k) is not None}


def main():
    main_book, *others = BOOKS
    cards = {}  # id главной записи → карточка
    order = []
    for x in load(main_book):
        cards[x['id']] = {'id': x['id'], 'refs': x['refs'], 'main': opinion(x), 'opinions': []}
        order.append(x['id'])
    for book in others:
        for x in load(book):
            # link: ["w001"] или [{"id": "w001", "verdict": …, "sabab": …}] — своя оценка для этой карточки
            links = [l if isinstance(l, dict) else {'id': l} for l in x['link']]
            linked = [(cards[l['id']], l) for l in links if l['id'] in cards]
            for n, (card, l) in enumerate(linked):
                card['opinions'].append({**opinion(x), **{k: l[k] for k in ('verdict', 'sabab') if k in l}})
                # запись этой книги может охватывать и другие аяты — первую карточку показываем и у них
                for s, f, t in (x['refs'] if n == 0 else []):
                    if not any(cs == s and cf <= t and f <= ct for cs, cf, ct in card['refs']):
                        card['refs'].append([s, f, t])
            if not linked:
                cards[x['id']] = {'id': x['id'], 'refs': x['refs'], 'main': opinion(x), 'opinions': []}
                order.append(x['id'])
    by_surah = {}
    for cid in order:
        c = cards[cid]
        for s, f, t in c['refs']:
            by_surah.setdefault(str(s), []).append({**c, 'from': f, 'to': t})
    for lst in by_surah.values():
        lst.sort(key=lambda c: (c['from'], c['id']))
    if os.path.isdir(OUT):
        for fn in os.listdir(OUT): os.remove(os.path.join(OUT, fn))
    os.makedirs(OUT, exist_ok=True)
    index = {'v': hashlib.md5(json.dumps(by_surah, ensure_ascii=False).encode()).hexdigest()[:8], 'books': BOOKS, 's': {}}
    for s, lst in by_surah.items():
        index['s'][s] = sorted({(c['from'], c['to']) for c in lst})
        for c in lst: del c['refs']
        json.dump(lst, open(os.path.join(OUT, f'{int(s):03d}.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(index, open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    size = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) // 1024
    merged = sum(len(c['opinions']) for c in cards.values())
    print(f'{len(order)} cards ({merged} merged opinions), {len(by_surah)} surahs -> public/data/asbab/ ({size} KB)')


if __name__ == '__main__':
    main()
