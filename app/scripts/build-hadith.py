"""
Сборка данных раздела «Хадисы» → public/data/hadith/

Источники:
  • Сборники (40 хадисов ан-Навави, Рияд ас-Салихин, Сахих аль-Бухари) — isnad.link
    (арабский текст и русский перевод). Берём только сборники, переведённые полностью.
  • Темы — «Энциклопедия хадисов» HadeethEnc.com (открытый API): хадис, источник, степень
    достоверности, объяснение и выводы, распределены по темам.

Запуск (один раз, результат хранится в проекте):  python scripts/build-hadith.py
Ответы сайтов кэшируются во временной папке, поэтому повторный запуск быстрый.
"""
import concurrent.futures as cf
import hashlib
import html
import json
import os
import re
import tempfile
import time
import urllib.request

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'hadith')
CACHE = os.path.join(tempfile.gettempdir(), 'hadith-cache')
UA = {'User-Agent': 'Mozilla/5.0 (quran-sunna-miniapp data build)'}
ISNAD = 'https://isnad.link'
ENC = 'https://hadeethenc.com/api/v1/'

COLLECTIONS = [
    {'id': 'nawawi', 'slug': 'al-arbauna-an-nawawiyya', 'name': '40 хадисов ан-Навави', 'ar': 'الأربعون النووية',
     'author': 'Имам ан-Навави', 'about': 'Сорок два главных хадиса, на которых держатся основы религии. С них традиционно начинают изучение хадисов.'},
    {'id': 'riyad', 'slug': 'riyadh-as-salikhin', 'name': 'Рияд ас-Салихин', 'ar': 'رياض الصالحين',
     'author': 'Имам ан-Навави', 'about': '«Сады праведных» — хадисы о нравственности, поклонении и поведении мусульманина, по главам.'},
    {'id': 'bukhari', 'slug': 'sahih-al-buhari', 'name': 'Сахих аль-Бухари', 'ar': 'صحيح البخاري',
     'author': 'Имам аль-Бухари', 'about': 'Самый достоверный сборник хадисов после Корана. 97 книг по темам.'},
    {'id': 'muslim', 'slug': 'sahih-muslim', 'name': 'Сахих Муслим', 'ar': 'صحيح مسلم',
     'author': 'Имам Муслим', 'about': 'Второй по достоверности сборник после «Сахиха» аль-Бухари. 54 книги по темам.',
     'part': 'Перевод на русский ещё не завершён: у части хадисов пока только арабский текст.'},
]


def get(url, as_json=False):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, hashlib.md5(url.encode()).hexdigest())
    if os.path.exists(path):
        raw = open(path, encoding='utf-8').read()
    else:
        for attempt in range(4):
            try:
                raw = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode('utf-8')
                break
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(2 + attempt * 3)
        open(path, 'w', encoding='utf-8').write(raw)
    return json.loads(raw) if as_json else raw


# ---------- очистка текста ----------
def paras(fragment):
    """HTML → список абзацев. Жирное (цитаты аятов) помечаем **…**"""
    fragment = re.sub(r'<(strong|b)>\s*', '**', fragment)
    fragment = re.sub(r'\s*</(strong|b)>', '**', fragment)
    out = []
    for p in re.findall(r'<p[^>]*>(.*?)</p>', fragment, re.S) or [fragment]:
        t = html.unescape(re.sub(r'<br\s*/?>', ' ', p))
        t = re.sub(r'<[^>]+>', '', t)
        t = re.sub(r'^\**\s*\[[0-9]{1,5}\]\s*\**\s*', '', t)
        t = re.sub(r'\[[٠-٩]{1,5}\]\s*', '', t)  # то же в арабском тексте  # «[1161] 1 (520) — …» (Муслим): сквозной номер не нужен
        t = re.sub(r'\[\d{1,3}\]', '', t)  # номера сносок: самих сносок на странице раздела нет
        t = t.replace('‏', '').replace('\xa0', ' ')
        t = re.sub(r'\*\*\s*\*\*', '', t)
        t = re.sub(r'\s+', ' ', t).strip()
        if t and t != '**':
            out.append(t)
    return out


def clean_title(t):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', t))).strip()


# ---------- isnad.link ----------
def section_items(page):
    """Страница раздела: заголовок (hadeeth-num) → русский текст (article) → арабский (message-body arabic)"""
    items = []
    blocks = re.split(r'<div class="column hadeeth">', page)[1:]
    for b in blocks:
        t = re.search(r'class="hadeeth-num">(.*?)</span>', b, re.S)
        ru = re.search(r'<div class="column">\s*<article>(.*?)</article>', b, re.S)
        ar = re.search(r'message-body arabic">(.*?)</div>\s*</article>', b, re.S)
        items.append({'t': clean_title(t.group(1)) if t else '', 'ru': paras(ru.group(1)) if ru else [], 'ar': paras(ar.group(1)) if ar else []})
    return items


def single_item(page):
    """Отдельная страница хадиса (40 ан-Навави)"""
    t = re.search(r'id="item_title">(.*?)</p>', page, re.S)
    ru = re.search(r'id="translated">\s*<div[^>]*>(.*?)</div>', page, re.S)
    ar = re.search(r'id="original"[^>]*>(.*?)</div>', page, re.S)
    return {'t': clean_title(t.group(1)) if t else '', 'ru': paras(ru.group(1)) if ru else [], 'ar': paras(ar.group(1)) if ar else []}


def book_list(slug):
    page = get(f'{ISNAD}/book/{slug}')
    links = re.findall(r'href="(/book/' + slug + r'/[^"/]+)"[^>]*>(.*?)</a>', page, re.S)
    out, seen = [], set()
    for href, inner in links:
        if href in seen:
            continue
        seen.add(href)
        cols = re.findall(r'<div class="column[^"]*">(.*?)</div>', inner, re.S)
        title = clean_title(cols[0]) if cols else clean_title(inner)
        ar = clean_title(cols[1]) if len(cols) > 1 else ''
        if not ar:
            parts = re.split(r'\s{2,}', re.sub(r'<[^>]+>', '  ', inner).strip())
            title, ar = clean_title(parts[0]), clean_title(parts[1]) if len(parts) > 1 else ''
        out.append({'href': href, 'title': title, 'ar': ar})
    return out


def short_title(title):
    """«Глава 4. О правдивости /сыдк/ (хадисы 54-59)» → («О правдивости /сыдк/», «54–59»)"""
    rng = re.search(r'\(хадисы?\s*([\d\s\-–—]+)\)', title) or re.search(r'\(([\d\s\-–—]+)\s*хадисы?\)', title)
    t = re.sub(r'\s*\((хадисы?[^)]*|[\d\s\-–—]+\s*хадисы?)\)', '', title)
    t = re.sub(r'^(Глава\s*)?\d+\.\s*', '', t)
    t = re.sub(r'^Книга:\s*', '', t).strip()  # «1. Книга: Начало откровений» → «Начало откровений», «2. Книга веры» — как есть
    t = t[:1].upper() + t[1:]
    return t, (re.sub(r'\s*[-–—]\s*', '–', rng.group(1).strip()) if rng else '')


def build_collection(c):
    books = book_list(c['slug'])
    os.makedirs(os.path.join(OUT, c['id']), exist_ok=True)
    meta_books = []
    if c['id'] == 'nawawi':
        # 42 хадиса — одна «книга»
        with cf.ThreadPoolExecutor(4) as ex:
            items = list(ex.map(lambda b: single_item(get(ISNAD + b['href'])), books))
        for it in items:
            it['t'] = re.sub(r'^(Хадис\s*)?\d+\.\s*', '', it['t'])
        write(c['id'], 1, {'title': c['name'], 'ar': c['ar'], 'items': items})
        meta_books.append({'n': 1, 'no': 1, 'title': c['name'], 'ar': c['ar'], 'range': f'1–{len(items)}', 'count': len(items)})
        return meta_books
    with cf.ThreadPoolExecutor(4) as ex:
        pages = list(ex.map(lambda b: get(ISNAD + b['href']), books))
    # «Книги» со вложенными главами (Рияд ас-Салихин 84–372, «Толкование Корана» у аль-Бухари) — одна группа:
    # в списке сборника это один пункт, а его главы открываются отдельным списком
    chapters = []  # (номер группы или None, глава, страница)
    groups = []
    for b, page in zip(books, pages):
        subs = re.findall(r'href="(' + re.escape(b['href']) + r'/[^"/]+)"[^>]*>(.*?)</a>', page, re.S)
        if 'hadeeth-num' not in page and subs:
            title, rng = short_title(b['title'])
            num = re.match(r'^(\d+)\.', b['title'])
            groups.append({'g': len(groups) + 1, 'no': int(num.group(1)) if num else 0, 'title': title, 'ar': b['ar'], 'range': rng})
            for href, inner in subs:
                parts = [clean_title(x) for x in re.split(r'<[^>]+>', inner) if clean_title(x)]
                ar = next((x for x in parts[1:] if re.search(r'[ء-ي]', x)), '')
                chapters.append((len(groups), {'href': href, 'title': parts[0], 'ar': ar}, None))
        else:
            chapters.append((None, b, page))
    with cf.ThreadPoolExecutor(4) as ex:
        loaded = list(ex.map(lambda x: x[2] or get(ISNAD + x[1]['href']), chapters))
    n = 0
    for (grp, b, _), page in zip(chapters, loaded):
        items = [it for it in section_items(page) if it['ru'] or it['ar']]
        if c['id'] in ('bukhari', 'muslim'):
            items = split_hadiths(items, c['id'])
        if not items:
            continue
        n += 1
        title, rng = short_title(b['title'])
        intro = bool(re.match(r'(Предисловие|О сборнике)', b['title']))
        write(c['id'], n, {'title': title, 'ar': b['ar'], 'items': items})
        num = re.match(r'^(?:Глава\s*)?(\d+)\.', b['title'])
        meta_books.append({'n': n, 'no': int(num.group(1)) if num else 0, 'title': title, 'ar': b['ar'], 'range': rng,
                           'count': len(items), **({'grp': grp} if grp else {}), **({'intro': 1} if intro else {})})
    for g in groups:
        g['count'] = sum(1 for x in meta_books if x.get('grp') == g['g'])
    c['groups'] = groups
    return meta_books


AR_DIG = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
# начало хадиса в русском тексте: «1224 — », «435, 436 — », Муслим: «1 (293) — », «(…) — »
RU_START = re.compile(r'^(\d{1,4}(?:\s*(?:,|и|[-–])\s*\d{1,4})*|\d{1,4}\s*\((?:\d{1,4}|…|\.\.\.)\)|\((?:\d{1,4}|…|\.\.\.)\))\s*[—–-]\s+')
# начало хадиса в арабском: аль-Бухари «**١٢٢٤:**», Муслим «**١** - (٢٩٣)»
AR_START = {'bukhari': re.compile(r'^\*\*\s*([٠-٩]+)\s*:\s*\*\*\s*'), 'muslim': re.compile(r'^\*\*\s*([٠-٩]+)\s*\*\*\s*[-–]?\s*')}


def ru_nums(label, cid):
    """Номера из метки: для Муслима — номер в книге (по нему сверяем с арабским), для аль-Бухари — общий"""
    if cid == 'muslim':
        m = re.match(r'^(\d+)', label)
        return {int(m.group(1))} if m else set()
    nums = set()
    for part in re.split(r'\s*,\s*|\s+и\s+', label):
        r = [int(x) for x in re.split(r'\s*[-–]\s*', part) if x.strip().isdigit()]
        nums.update(range(r[0], r[1] + 1) if len(r) == 2 and r[1] - r[0] < 20 else r[:1])
    return nums


def hadith_label(label, cid):
    """Что показать на значке: аль-Бухари — «1224» / «435, 436»; Муслим — общий номер «293» (или номер в книге)"""
    if cid == 'muslim':
        m = re.search(r'\((\d+)\)', label)
        return m.group(1) if m else ''
    return re.sub(r'\s+', ' ', label)


def split_hadiths(items, cid):
    """isnad.link кладёт все хадисы главы (баба) в один блок — делим: каждый хадис отдельно,
    арабский текст прикрепляем по номеру. Вступление главы (слова автора, аяты) — отдельная карточка."""
    out = []
    for it in items:
        pre_ru, segs = [], []  # segs: [метка, номера, абзацы]
        for p in it['ru']:
            m = RU_START.match(p)
            if m:
                label = m.group(1)
                nums = ru_nums(label, cid)
                if cid == 'muslim' and not nums and segs:  # «(…) — Этот хадис подобен…» — вариант предыдущего
                    segs[-1][2].append(p[m.end():])
                    continue
                segs.append([label, nums, [p[m.end():]]])
            elif segs:
                segs[-1][2].append(p)
            else:
                pre_ru.append(p)
        pre_ar, ar_segs = [], []  # ar_segs: [номер, абзацы]
        for p in it['ar']:
            m = AR_START[cid].match(p)
            if m:
                ar_segs.append([int(m.group(1).translate(AR_DIG)), [p[m.end():]]])
            elif ar_segs:
                ar_segs[-1][1].append(p)
            else:
                pre_ar.append(p)
        if not segs:  # номеров нет — оставляем как есть
            out.append(it)
            continue
        if pre_ru:
            out.append({'t': it['t'], 'ru': pre_ru, 'ar': pre_ar})
        used = set()
        for label, nums, paras in segs:
            ar = [x for n, ps in ar_segs if n in nums for x in ps]
            used |= {n for n, _ in ar_segs if n in nums}
            out.append({'t': it['t'], 'h': hadith_label(label, cid), 'ru': paras, 'ar': ar})
        # хадисы без перевода — только арабский текст, на своём месте по номеру
        for n, ps in ar_segs:
            if n in used:
                continue
            item = {'t': it['t'], 'h': str(n) if cid == 'bukhari' else '', 'ru': [], 'ar': ps}
            pos = next((k for k, x in enumerate(out) if x.get('h', '').split(',')[0].strip().isdigit()
                        and cid == 'bukhari' and int(x['h'].split(',')[0]) > n and x['t'] == it['t']), len(out))
            out.insert(pos, item)
    return out


def write(cid, n, obj):
    json.dump(obj, open(os.path.join(OUT, cid, f'{n}.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))


NUM = re.compile(r'^(\d{1,4}(?:\s*(?:,|и|[-–])\s*\d{1,4})*)\s*[—–-]\s')


def hadith_numbers(items):
    """Номера хадисов с переводом: «54 — », «435, 436 — », «408–411 — » в начале абзаца"""
    nums = set()
    for it in items:
        for p in it['ru']:
            m = NUM.match(p)
            if not m:
                continue
            for part in re.split(r'\s*,\s*|\s+и\s+', m.group(1)):
                r = re.split(r'\s*[-–]\s*', part)
                nums.update(range(int(r[0]), int(r[1]) + 1) if len(r) == 2 and int(r[1]) - int(r[0]) < 20 else [int(r[0])])
    return nums


# ---------- HadeethEnc: темы ----------
def build_topics():
    cats = get(ENC + 'categories/list/?language=ru', True)
    cat_list = [{'id': int(x['id']), 'title': x['title'].strip(), 'parent': int(x['parent_id']) if x['parent_id'] else 0} for x in cats]
    ids = {}
    leafs = [x for x in cat_list]

    def list_cat(cid):
        out, page = [], 1
        while True:
            r = get(f'{ENC}hadeeths/list/?language=ru&category_id={cid}&page={page}&per_page=100', True)
            out += [(d['id'], d['title']) for d in r['data']]
            meta = r.get('meta', {})
            if page >= int(meta.get('last_page', 1)):
                return out
            page += 1

    with cf.ThreadPoolExecutor(6) as ex:
        for cat, lst in zip(leafs, ex.map(lambda x: list_cat(x['id']), leafs)):
            cat['ids'] = [int(i) for i, _ in lst]
            for i, _ in lst:
                ids[int(i)] = True
    all_ids = sorted(ids)
    print(f'  тем: {len(cat_list)}, хадисов: {len(all_ids)}')

    def one(i):
        d = get(f'{ENC}hadeeths/one/?language=ru&id={i}', True)
        hints = [h.strip() for h in d.get('hints') or [] if h and h.strip()]
        ru, intro = d['hadeeth'].strip(), (d.get('hadeeth_intro') or '').strip()
        return {'id': i, 't': d['title'].strip(), 'ru': ru, 'in': intro if intro and ru.startswith(intro) else '',
                'ar': (d.get('hadeeth_ar') or '').strip(),
                'src': (d.get('attribution') or '').strip(), 'grade': (d.get('grade') or '').strip(),
                'ex': (d.get('explanation') or '').strip(), 'hints': hints}

    with cf.ThreadPoolExecutor(8) as ex:
        hadiths = list(ex.map(one, all_ids))
    CH = 60
    os.makedirs(os.path.join(OUT, 'enc'), exist_ok=True)
    index = {}
    for k in range(0, len(hadiths), CH):
        part = hadiths[k:k + CH]
        json.dump({str(h['id']): h for h in part}, open(os.path.join(OUT, 'enc', f'{k // CH}.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        for h in part:
            index[h['id']] = [k // CH, h['t']]
    # API отдаёт в теме и хадисы всех её подтем: число — по полному списку, а в самой теме оставляем только «свои»
    children = {c['id']: [x for x in cat_list if x['parent'] == c['id']] for c in cat_list}

    def below(cid):
        out = set()
        for ch in children[cid]:
            out |= set(ch['ids']) | below(ch['id'])
        return out
    by_id = {c['id']: c for c in cat_list}
    topics = []
    for c in cat_list:
        if not c['ids']:
            continue
        sub = below(c['id'])
        own = [i for i in c['ids'] if i not in sub]
        topics.append({'id': c['id'], 'title': c['title'], 'parent': c['parent'], 'count': len(set(c['ids'])), 'ids': own})
    assert all(t['parent'] == 0 or t['parent'] in by_id for t in topics)
    json.dump({'topics': topics, 'hadiths': index}, open(os.path.join(OUT, 'topics.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    return hadiths


def main():
    meta = []
    for c in COLLECTIONS:
        print('Сборник:', c['name'])
        books = build_collection(c)
        nums = set()
        for b in books:
            items = json.load(open(os.path.join(OUT, c['id'], f"{b['n']}.json"), encoding='utf-8'))['items']
            if c['id'] == 'nawawi':
                nums |= set(range(1, len(items) + 1))
            elif c['id'] == 'bukhari':  # хадисы уже разделены: номер — на значке
                nums |= {n for it in items if it['ru'] and it.get('h') for n in ru_nums(it['h'], 'bukhari')}
            elif c['id'] == 'muslim':
                nums |= {(b['n'], k) for k, it in enumerate(items) if it['ru'] and 'h' in it}
            else:
                nums |= hadith_numbers(items)
        total = len(nums)
        print(f'  книг/глав: {len(books)}, хадисов: {total}')
        meta.append({k: c[k] for k in ('id', 'name', 'ar', 'author', 'about')} | {'hadiths': total, 'books': books, 'groups': c.get('groups', [])}
                    | ({'part': c['part']} if c.get('part') else {}))
    print('Темы (HadeethEnc)…')
    hadiths = build_topics()
    # «Хадис дня» — короткие хадисы из энциклопедии (с объяснением)
    CH = 60
    daily = [[h['id'], k // CH] for k, h in enumerate(hadiths) if 60 <= len(h['ru']) <= 420 and h['ex']]
    json.dump({'collections': meta, 'daily': daily,
               'source': 'Сборники — isnad.link; темы — HadeethEnc.com (Энциклопедия переведённых пророческих хадисов)'},
              open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'Хадис дня: {len(daily)} кандидатов')


if __name__ == '__main__':
    main()
