"""
Сборка раздела «99 имён Аллаха» → public/data/names.json

Источник: Са‘ид ибн ‘Али ибн Вахф аль-Кахтани, «Толкование прекрасных имён Аллаха в свете Корана и Сунны»
(пер. Э. Р. Кулиева, UMMAH, 2011) — текст с сайта «Библиотека Мусульманина» kitab.center
(некоммерческое использование со ссылкой на источник). Список из 99 имён — по этой книге.

Запуск (один раз, результат хранится в проекте):  python scripts/build-names.py
"""
import hashlib
import html
import json
import os
import re
import tempfile
import time
import urllib.request

BASE = 'https://kitab.center/sharh-asma-qahtani/'
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'names.json')
CACHE = os.path.join(tempfile.gettempdir(), 'names-cache')
UA = {'User-Agent': 'Mozilla/5.0 (quran-sunna-miniapp data build)'}


def get(url):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, hashlib.md5(url.encode()).hexdigest())
    if not os.path.exists(path):
        raw = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode('utf-8')
        open(path, 'w', encoding='utf-8').write(raw)
        time.sleep(0.5)
    return open(path, encoding='utf-8').read()


def body(page):
    m = re.search(r'<div class="article-body">(.*?)(?:<div class="[^"]*(?:pager|pagination|article-nav)|Prev\s*</a>|<ul class="pager)', page, re.S)
    return m.group(1) if m else ''


def text(fragment):
    t = html.unescape(re.sub(r'<br\s*/?>', ' ', fragment))
    t = re.sub(r'<[^>]+>', '', t).replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', t).strip()


def norm(s):
    return re.sub(r'[^а-яё]', '', s.lower().replace('ё', 'е'))


# ---------- список 99 имён ----------
def parse_list():
    names = []
    for p in re.findall(r'<p>(.*?)</p>', body(get(BASE + 'devyanosto-devyat-imjon-allaha.html')), re.S):
        raw = html.unescape(p).replace('\xa0', ' ')
        m = re.match(r'\s*(.+?)\s*[-–—]\s*(.+)$', re.sub(r'<(?!/?strong)[^>]+>', '', raw))
        if not m:
            continue
        ar = re.sub(r'^[ِّ\s]+', '', m.group(1)).strip()  # у некоторых строк в начале «висит» шадда
        rest = m.group(2)
        mean = re.search(r'\(([^()]+)\)\s*$', re.sub(r'<[^>]+>', '', rest))
        tr_html = rest[:rest.rfind('(')] if mean else rest
        # ударная гласная выделена <strong> — запоминаем её позицию
        stress, tr = -1, ''
        for part in re.split(r'(<strong>.*?</strong>)', tr_html):
            if part.startswith('<strong>'):
                stress = len(tr) if stress < 0 else stress
                tr += re.sub(r'<[^>]+>', '', part)
            else:
                tr += re.sub(r'<[^>]+>', '', part)
        tr = re.sub(r'\s+', ' ', tr).strip()
        lead = len(re.sub(r'<[^>]+>', '', tr_html)) - len(re.sub(r'<[^>]+>', '', tr_html).lstrip())
        names.append({'n': len(names) + 1, 'ar': ar, 'tr': tr, 'st': max(-1, stress - lead) if stress >= 0 else -1,
                      'ru': mean.group(1).strip() if mean else ('Аллах' if 'الله' in ar else '')})
    return names


# ---------- толкования (по группам имён) ----------
REF = re.compile(r'\(сур[аы]?\s*(\d{1,3})\s*«[^»]*»,?\s*аяты?\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?\)')


def parse_group(url):
    page = get(url)
    title = text(re.search(r'<h1[^>]*>(.*?)</h1>', page, re.S).group(1))
    paras = []
    for p in re.findall(r'<p[^>]*>(.*?)</p>', body(page), re.S):
        p = re.sub(r'<(strong|b)>\s*', '**', p)
        p = re.sub(r'\s*</(strong|b)>', '**', p)
        t = text(p).replace('** **', ' ')
        t = re.sub(r'\s+([.,;:])', r'\1', t)
        if t and t != '**':
            paras.append(t)
    refs = []
    for para in paras:
        for m in REF.finditer(para):
            ref = [int(m.group(1)), int(m.group(2))]
            if ref not in refs and 1 <= ref[0] <= 114:
                refs.append(ref)
    return {'title': title, 'text': paras, 'ayahs': refs[:12], 'url': url}


# имена с похожими значениями, которые автоматически сопоставляются неоднозначно
FIX = {
    18: 'vsemogushchij-vsesilnyj.html',      # Аль-Кадир — «Всемогущий»
    20: 'vsemogushchij-vsesilnyj.html',      # Аль-Муктадир
    32: 'hranitel.html',                     # Аль-Хафиз — «Хранитель всякой вещи» (11:57)
    74: 'hranitel-2.html',                   # Аль-Мухаймин — «свидетельствует, охватывает знанием»
    50: 'dobrodetelnyj-daruyushchij.html',   # Аль-Ваххаб (3:8 «Ты — Дарующий»)
}


def main():
    names = parse_list()
    print('Имён в списке:', len(names))
    index = get(BASE + 'devyanosto-devyat-imjon-allaha.html')
    links = sorted(set(re.findall(r'href="(imena-allaha-znacheniya/[^"]+\.html)"', index)))
    groups = [parse_group(BASE + l) for l in links]
    print('Страниц толкований:', len(groups))
    # сопоставление: значение имени ↔ заголовок страницы («Милостивый, Милующий, …»)
    for g in groups:
        g['keys'] = [norm(x) for x in re.split(r'[,()]|\sи\s', g['title']) if norm(x)]
    out_groups = []
    missing = []
    strip = lambda x: re.sub(r'[ً-ْٰـ]', '', x)  # арабский без огласовок
    for g in groups:
        g['blob'] = ' '.join(g['text'])
        g['blob_ar'] = strip(g['blob'])
    for nm in names:
        keys = [norm(x) for x in re.split(r'[,()]', nm['ru']) if norm(x)]
        tr_core = re.sub(r'^(Аль|Ар|Ас|Аз|Аш|Ат|Ан)-', '', nm['tr'])
        best, best_score = None, 0
        for gi, g in enumerate(groups):
            score = 0
            if norm(g['title']) == norm(nm['ru']):
                score += 10  # заголовок страницы — ровно это значение
            if keys and all(k in g['keys'] for k in keys):
                score += 4
            elif any(k in g['keys'] for k in keys):
                score += 1
            if re.search(r'(?<![а-яё])' + re.escape(tr_core.lower()) + r'(?![а-яё])', g['blob'].lower()):
                score += 3  # имя транскрипцией в тексте толкования («ас-Самад»)
            if strip(nm['ar']).replace('ال', '', 1) and strip(nm['ar']) in g['blob_ar']:
                score += 3
            if score > best_score:
                best, best_score = gi, score
        if nm['n'] in FIX:  # проверено вручную по тексту страниц
            best = next(gi for gi, g in enumerate(groups) if g['url'].endswith('/' + FIX[nm['n']]))
        if best is None:
            missing.append(f"{nm['n']} {nm['tr']} ({nm['ru']})")
        else:
            nm['g'] = best
    for g in groups:
        out_groups.append({'title': g['title'], 'text': g['text'], 'ayahs': g['ayahs'], 'url': g['url']})
    print('Без толкования:', len(missing), missing)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({'names': names, 'groups': out_groups,
               'source': 'Са‘ид аль-Кахтани, «Толкование прекрасных имён Аллаха в свете Корана и Сунны», пер. Э. Р. Кулиева — kitab.center'},
              open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
