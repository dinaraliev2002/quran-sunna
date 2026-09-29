"""
Сборка данных раздела «Азкары» (Крепость мусульманина) → public/data/azkar.json

Источники:
  • Тексты, русский перевод, источники хадисов, группы и главы — открытая библиотека
    my-prayers/muslim-data-android (лицензия Apache-2.0), база SQLite.
  • Число повторов и аудио к каждому азкару — hisnmuslim.com (сопоставление по арабскому тексту).

Запуск (один раз, результат хранится в проекте):  python scripts/build-azkar.py
"""
import concurrent.futures as cf
import difflib
import json
import os
import re
import sqlite3
import tempfile
import urllib.request

DB_URL = 'https://raw.githubusercontent.com/my-prayers/muslim-data-android/main/muslim-data/src/main/assets/database/muslim_db_v2.5.1.db'
HISN = 'https://www.hisnmuslim.com/api/ar/'
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'azkar.json')
UA = {'User-Agent': 'quran-sunna-miniapp/0.1 (data build)'}


def get(url, binary=False):
    raw = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
    return raw if binary else json.loads(raw.decode('utf-8-sig'))


def norm(s):
    """Арабские буквы без огласовок и вариантов алифа — для сравнения текстов"""
    s = re.sub(r'[آأإ]', 'ا', s)
    return re.sub(r'[^ء-ي]', '', s)


def clean_ru(s):
    """Убрать номера сносок, прилипшие к словам («прежде83» → «прежде»), и лишние пробелы"""
    # только цифры, прилипшие к букве или закрывающей кавычке (номера аятов вида «2:255» не трогаем)
    s = re.sub(r'(?<=[а-яёА-ЯЁ»])\d{1,3}(?=[\s,.;:!?»\)\]]|$)', '', s)
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()


REPEAT_WORDS = [('مائة مرة', 100), ('مئة مرة', 100), ('عشر مرات', 10), ('سبع مرات', 7), ('أربع مرات', 4),
                ('ثلاث مرات', 3), ('ثلاثَ مرَّاتٍ', 3), ('مرتين', 2)]


def repeat_from_text(ar):
    for w, n in REPEAT_WORDS:
        if w in ar:
            return n
    return 1


def main():
    db_path = os.path.join(tempfile.gettempdir(), 'muslim_db.db')
    if not os.path.exists(db_path):
        print('Скачиваю базу…')
        open(db_path, 'wb').write(get(DB_URL, binary=True))
    c = sqlite3.connect(db_path)
    q = lambda sql, *a: c.execute(sql, a).fetchall()

    cats = [{'id': i, 'name': n} for i, n in q("select category_id, category_name from azkar_category_translation where language='ru' order by category_id")]
    chapters = []
    for cid, cat, name in q("select c._id, c.category_id, t.chapter_name from azkar_chapter c join azkar_chapter_translation t on t.chapter_id=c._id and t.language='ru' order by c._id"):
        items = [r[0] for r in q('select _id from azkar_item where chapter_id=? order by _id', cid)]
        chapters.append({'id': cid, 'cat': cat, 'name': name, 'items': items})

    print('Загружаю hisnmuslim.com (повторы и аудио)…')
    index = get(HISN + 'husn_ar.json')
    ch_ids = [x['ID'] for x in index[list(index)[0]]]
    hisn = []
    with cf.ThreadPoolExecutor(8) as ex:
        for d in ex.map(lambda ch: get(f'{HISN}{ch}.json'), ch_ids):
            hisn += d[list(d)[0]]
    H = [(norm(h['ARABIC_TEXT'])[:80], h) for h in hisn]

    items = {}
    weak = 0
    for iid, ch, ar in q('select _id, chapter_id, item from azkar_item order by _id'):
        ru = q("select item_translation from azkar_item_translation where item_id=? and language='ru'", iid)
        ref = q("select t.reference from azkar_reference r join azkar_reference_translation t on t.reference_id=r._id where r.item_id=? and t.language='ru'", iid)
        na = norm(ar)[:80]
        best = max(H, key=lambda h: difflib.SequenceMatcher(None, na, h[0]).ratio())
        ratio = difflib.SequenceMatcher(None, na, best[0]).ratio()
        item = {'ch': ch, 'ar': ar.strip(), 'ru': clean_ru(ru[0][0]) if ru else '', 'ref': ref[0][0].strip() if ref else ''}
        # повторы — из hisnmuslim при уверенном совпадении, иначе по словам «три раза» и т.п. в тексте
        item['rep'] = best[1]['REPEAT'] if ratio >= 0.8 else repeat_from_text(ar)
        # аудио — только если текст совпадает почти полностью (у вечерних азкаров слова отличаются от утренних)
        strict = 0.97 if ch == 28 else 0.8
        if ratio >= strict and best[1].get('AUDIO'):
            item['audio'] = best[1]['AUDIO'].replace('http://', 'https://')
        if ratio < 0.8:
            weak += 1
        items[iid] = item

    data = {'categories': cats, 'chapters': chapters, 'items': items,
            'source': 'my-prayers/muslim-data-android (Apache-2.0); повторы и аудио — hisnmuslim.com'}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    with_audio = sum(1 for i in items.values() if 'audio' in i)
    print(f'Групп: {len(cats)}, глав: {len(chapters)}, азкаров: {len(items)}, с аудио: {with_audio}, слабых совпадений: {weak}')


if __name__ == '__main__':
    main()
