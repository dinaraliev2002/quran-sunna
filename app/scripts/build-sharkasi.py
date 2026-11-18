"""
Сборка второй версии «Сахиха» аль-Бухари — перевод Абу Ислама аш-Шаркаси («Достоверный сборник», экспериментальное издание №1 / 2026).
Используется с письменного разрешения переводчика. PDF в проект не кладём — путь передаём аргументом.

Что делает:
  1. Читает текст PDF, убирает колонтитулы, делит на книги по «Содержанию» (в PDF их 47 из 97).
  2. Делит книгу на главы, хадисы (номер совпадает с номером в нашей версии) и абзацы.
  3. Арабский текст хадиса берёт из нашей версии (public/data/hadith/bukhari) по номеру хадиса, но только если перевод совпал по словам.
  4. Пишет public/data/hadith/sharkasi/{no}.json и добавляет сборник «sharkasi» в index.json.

Запуск:  python -X utf8 scripts/build-sharkasi.py "C:/путь/Достоверный сборник.pdf"
"""
import glob
import json
import os
import re
import sys

import pymupdf

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'hadith')
OUT = os.path.join(ROOT, 'sharkasi')
SHY = '\u00ad'


def clean(s: str) -> str:
    s = s.replace(SHY, '').replace('\xa0', ' ').replace('‑', '-').replace('\u200b', '')
    return re.sub(r'[ \t]+', ' ', s).strip()


def read_pages(pdf: str):
    """→ список (номер страницы, [строки]) без колонтитулов"""
    d = pymupdf.open(pdf)
    pages = []
    for i, pg in enumerate(d):
        ls = pg.get_text().split('\n')
        if i >= 5 and ls and re.fullmatch(r'\d+', ls[0].strip()):
            ls = ls[2:]  # номер страницы + название книги/«Достоверный сборник»
        pages.append((i, [clean(x) for x in ls if clean(x)]))
    return pages


def read_toc(pages):
    """Содержание: [(номер книги, название, страница начала)]"""
    flat = [l for _, ls in pages for l in ls]
    start = max(i for i, l in enumerate(flat) if l == 'СОДЕРЖАНИЕ')
    items, buf = [], ''
    for l in flat[start + 1:]:
        buf = (buf + ' ' + l).strip()
        m = re.match(r'^(.*?)\.{2,}\s*(\d+)$', buf)
        if m:
            items.append((m.group(1).strip(), int(m.group(2))))
            buf = ''
    out = []
    seq = 0
    for title, pg in items:
        m = re.match(r'^(\d+)[\.\s]*(?:-?я)?\s*[Кк]нига[\.,:]?\s*(.*)$', title)
        if m:
            no = int(m.group(1))
            name = m.group(2).strip(' .') or 'Шуф‘а'
        else:
            name = re.sub(r'^[Кк]нига[\.:]?\s*', '', title).strip(' .')
            no = None
        out.append([no, name, pg])
    # у первых книг номера не напечатаны: их порядок в аль-Бухари 1–16 подряд (дальше в «Содержании» номера есть)
    k = 0
    for it in out:
        if it[0] is None:
            k += 1
            it[0] = k
        else:
            k = it[0]
    return out


def pretty(name: str) -> str:
    name = name.replace('Аль- ', 'Аль-').replace('Ас- ', 'Ас-').replace('Тайаммума', 'Тайаммум')
    name = re.sub(r'\s+', ' ', name)
    return name[:1].upper() + name[1:]


HEAD = re.compile(r'^(?:\d+\s+)?[Гг]лава\b')
NUM = re.compile(r'^(\d{1,4})\. (?=\S)')
SKIP = re.compile(r'^(\d+[\.\s]*)?КНИГА\b|^С именем Аллаха|^Всемилостивого, Милующего|^Бисмилл?яхир|^БисмиЛляхир|^\d+\s*[Кк]нига\b')


def paragraphs(lines):
    """Склеивает строки в абзацы: новый абзац — после короткой строки с точкой"""
    paras, cur = [], ''
    for i, l in enumerate(lines):
        if cur:
            if cur.endswith('-') and not cur.endswith(' -') and not cur.endswith('—'):
                cur = cur[:-1] + l  # перенос слова
            else:
                cur += ' ' + l
        else:
            cur = l
        short = len(l) < 44 and l[-1:] in '.»!?)"”'
        if short and i + 1 < len(lines):
            paras.append(cur)
            cur = ''
    if cur:
        paras.append(cur)
    return [re.sub(r'\s+', ' ', p).strip() for p in paras if p.strip()]


def parse_book(lines, state):
    """→ список элементов {ch: номер главы, ct: заголовок, h: номер хадиса или None, ru: [абзацы]}"""
    items = []
    ch, ct = 0, ''
    cur = None  # текущий элемент
    buf = []
    seen = state['seen']

    def flush():
        nonlocal buf, cur
        if cur is not None:
            cur['ru'] += paragraphs(buf)
        buf = []

    i = 0
    n = len(lines)
    while i < n:
        l = lines[i]
        if SKIP.match(l):
            i += 1
            continue
        if HEAD.match(l):
            flush()
            title = l
            # заголовок может быть в нескольких строках — до строки с точкой/кавычкой на конце
            while not re.search(r'[\.»?:!)”]$', title) and i + 1 < n and not NUM.match(lines[i + 1]) and len(title) < 400:
                i += 1
                nxt = lines[i]
                title = (title[:-1] + nxt) if title.endswith('-') else title + ' ' + nxt
            title = re.sub(r'\s+', ' ', title)
            ch += 1
            title = re.sub(r'^\d+\s+[Гг]лава[\.:]?\s*', '', title)
            title = re.sub(r'^[Гг]лава[\.:]?\s*', '', title)
            ct = title.strip()
            cur = {'ch': ch, 'ct': ct, 'h': None, 'ru': []}
            items.append(cur)
            i += 1
            continue
        m = NUM.match(l)
        if m:
            v = int(m.group(1))
            last_h = state['last']
            ok = (v > last_h or last_h - v < 15) and v - last_h < 80
            if ok:
                flush()
                seen.add(v)
                state['last'] = max(last_h, v)
                if ch == 0:
                    ch, ct = 1, ''
                cur = {'ch': ch, 'ct': ct, 'h': str(v), 'ru': []}
                items.append(cur)
                buf = [l[m.end():]]
                i += 1
                continue
        if cur is None:
            cur = {'ch': 0, 'ct': '', 'h': None, 'ru': []}
            items.append(cur)
        buf.append(l)
        i += 1
    flush()
    return [x for x in items if x['ru'] or x['h']]


def words(s: str):
    return {w[:5] for w in re.findall(r'[а-яё‘’\']{5,}', s.lower())}


def load_ours():
    H = {}
    for f in glob.glob(os.path.join(ROOT, 'bukhari', '*.json')):
        for it in json.load(open(f, encoding='utf-8'))['items']:
            if it.get('h') and it['h'] not in H:
                H[it['h']] = it
    return H


def main(pdf):
    pages = read_pages(pdf)
    toc = read_toc(pages)
    ours = load_ours()
    idx_path = os.path.join(ROOT, 'index.json')
    idx = json.load(open(idx_path, encoding='utf-8'))
    ob = next(c for c in idx['collections'] if c['id'] == 'bukhari')
    ar_title = {}
    for b in ob['books']:
        if b['no'] and 'grp' not in b and 'كِتَاب' in b['ar'] and b['no'] not in ar_title:
            ar_title[b['no']] = b['ar']
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(os.path.join(OUT, '*.json')):
        os.remove(f)

    books, total, with_ar, bad, empty_ru = [], 0, 0, [], 0
    state = {'seen': set(), 'last': 0}
    parsed, renum = [], []
    for k, (no, name, p0) in enumerate(toc):
        p1 = toc[k + 1][2] if k + 1 < len(toc) else 10**6
        lines = [l for pn, ls in pages if p0 <= pn < p1 for l in ls]
        if k == 0:
            lines = [l for l in lines if l != 'Достоверный сборник']
        its = parse_book(lines, state)
        # ошибки нумерации в книге (например, «256» вместо 246): ищем среди соседних номеров нашей версии лучшее совпадение по словам
        taken = {it['h'] for it in its if it['h']}
        for it in its:
            if not it['h']:
                continue
            a = words(' '.join(it['ru']))
            o = ours.get(it['h'])
            sim = (lambda ob: len(a & words(' '.join(ob['ru']))) / max(1, min(len(a), len(words(' '.join(ob['ru'])))))) if True else None
            if o and len(a) >= 4 and sim(o) >= 0.2:
                continue
            best, bs = None, 0.3
            for d in range(-10, 11):
                c = str(int(it['h']) + d)
                if c in taken and c != it['h']:
                    continue
                oc = ours.get(c)
                if oc and len(words(' '.join(oc['ru']))) >= 4 and sim(oc) > bs:
                    best, bs = c, sim(oc)
            if best and best != it['h']:
                renum.append((it['h'], best))
                taken.discard(it['h'])
                taken.add(best)
                it['h'] = best
        out, nh, first, last = [], 0, None, None
        for it in its:
            ru = it['ru']
            t = f"{it['ch']}. Глава: {it['ct']}" if it['ct'] else f"{it['ch']}. Глава"
            rec = {'t': t, 'ru': ru, 'ar': []}
            if it['h']:
                rec['h'] = it['h']
                nh += 1
                first = first or it['h']
                last = it['h']
                o = ours.get(it['h'])
                if o and o.get('ar'):
                    a, b = words(' '.join(ru)), words(' '.join(o['ru']))
                    sim = len(a & b) / max(1, min(len(a), len(b)))
                    if sim >= 0.2 or min(len(a), len(b)) < 4:
                        rec['ar'] = o['ar']
                        with_ar += 1
                    else:
                        bad.append((it['h'], round(sim, 2)))
                if not ru:
                    empty_ru += 1
            out.append(rec)
        total += nh
        title = pretty(name)
        data = {'title': title, 'ar': ar_title.get(no, ''), 'items': out}
        json.dump(data, open(os.path.join(OUT, f'{no}.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        books.append({'n': no, 'no': no, 'title': title, 'ar': ar_title.get(no, ''), 'range': f'{first}–{last}' if first else '', 'count': len(out)})
        print(f'{no:>3} {title[:60]:<60} стр.{p0:>4}  хадисов {nh:>4}  записей {len(out):>4}  {first}–{last}')
    col = {
        'id': 'sharkasi', 'name': 'Достоверный сборник (аш-Шаркаси)', 'ar': 'صحيح البخاري', 'author': 'Имам аль-Бухари, перевод Абу Ислама аш-Шаркаси',
        'about': 'Другой перевод «Сахиха» аль-Бухари на русский: Абу Ислам аш-Шаркаси, экспериментальное издание 2026 года. Пока в нём первые 47 книг из 97; арабский текст — из основной версии.',
        'hadiths': total, 'books': books, 'groups': [], 'part': 'Переведены не все книги: пока первые 47 из 97, остальные появятся позже.'}
    idx['collections'] = [c for c in idx['collections'] if c['id'] != 'sharkasi']
    i = next(j for j, c in enumerate(idx['collections']) if c['id'] == 'bukhari')
    idx['collections'].insert(i + 1, col)
    json.dump(idx, open(idx_path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'\nВсего хадисов {total}, с арабским {with_ar}, не совпали по словам {len(bad)}, пустых {empty_ru}')
    print('не совпали:', bad[:60])
    print('перенумеровано:', renum)


if __name__ == '__main__':
    main(sys.argv[1])
