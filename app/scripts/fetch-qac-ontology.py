"""Бережно скачивает онтологию понятий Quranic Arabic Corpus (corpus.quran.com) → app/morph-src/qac-ontology/ (в git не входит).
Что берём: список понятий (topics.jsp), страницу каждого понятия (описание, классификация) и список аятов (search.jsp?q=con:<id>).
Правила вежливости: одна загрузка за раз, пауза между запросами, заголовок с названием приложения, всё сохраняется на диск —
повторный запуск продолжает с места остановки и ничего не качает второй раз. За один запуск не больше MAX_REQUESTS запросов.
Условия корпуса: использовать можно, если указать источник (Quranic Arabic Corpus) и дать ссылку на corpus.quran.com.

Запуск:  python -I scripts/fetch-qac-ontology.py [число_запросов]
"""
import io
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CACHE = os.path.join(ROOT, 'morph-src', 'qac-ontology')
BASE = 'https://corpus.quran.com/'
UA = 'QuranSunnaApp-research (personal Quran study app; polite, 1 request per 2.5 s)'
DELAY = 2.5
MAX_REQUESTS = int(sys.argv[1]) if len(sys.argv) > 1 else 150
MAX_PAGES = 12  # у частых понятий (Аллах — 2700 слов) хватает первых 600 упоминаний: подробные списки не нужны

done = 0


def get(name, url):
    """Страница из кэша или с сайта; None — лимит запросов этого запуска исчерпан"""
    global done
    path = os.path.join(CACHE, name)
    if os.path.exists(path):
        return io.open(path, encoding='utf-8').read()
    if done >= MAX_REQUESTS:
        return None
    time.sleep(DELAY)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for attempt in range(3):
        try:
            html = urllib.request.urlopen(req, timeout=40).read().decode('utf-8', 'replace')
            break
        except Exception as e:  # сеть или сервер занят — ждём подольше и пробуем ещё
            print('  ошибка', name, e)
            time.sleep(15 * (attempt + 1))
    else:
        return None
    done += 1
    io.open(path, 'w', encoding='utf-8').write(html)
    return html


def main():
    os.makedirs(CACHE, exist_ok=True)
    top = get('topics.html', BASE + 'topics.jsp')
    if not top:
        return
    ids = sorted(set(urllib.parse.unquote(x) for x in re.findall(r'concept\.jsp\?id=([^"&]+)"', top)))
    print(len(ids), 'понятий в указателе')
    left = 0
    for cid in ids:
        key = re.sub(r'[^a-z0-9-]', '_', cid)
        page = get(f'c_{key}.html', BASE + 'concept.jsp?id=' + urllib.parse.quote(cid))
        if page is None:
            left += 1
            continue
        q = urllib.parse.quote('con:' + cid, safe='')
        first = get(f's_{key}_1.html', f'{BASE}search.jsp?q={q}&s=1&page=1')
        if first is None:
            left += 1
            continue
        m = re.search(r'Results <b>\d+</b> to <b>\d+</b> of <b>(\d+)</b>', first)
        total = int(m.group(1)) if m else 0
        pages = min(MAX_PAGES, -(-total // 50))
        for p in range(2, pages + 1):
            if get(f's_{key}_{p}.html', f'{BASE}search.jsp?q={q}&s=1&page={p}') is None:
                left += 1
                break
    print(f'за этот запуск запросов: {done}; понятий осталось докачать: {left}')


if __name__ == '__main__':
    main()
