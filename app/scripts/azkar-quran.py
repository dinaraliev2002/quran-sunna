"""
Аяты в азкарах — точно как в мусхафе.

В базе «Крепости мусульманина» (muslim-data-android) арабский текст набран обычной орфографией: без знаков
мадда, с «السموات» вместо «ٱلسَّمَـٰوَٰتِ» и т. п. Здесь находим в азкарах места, где читаются аяты, и заменяем
их текстом мусхафа (усмани) из public/data/quran, со знаками конца аята. Повторный запуск ничего не портит.

Запуск после build-azkar.py:  python scripts/azkar-quran.py
"""
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')

# Азкары, где именно читаются аяты (а не хадис, в котором случайно совпали несколько слов с Кораном)
# и какие суры там читаются
QURAN_ITEMS = {4: {3}, 70: {112, 113, 114}, 71: {2}, 75: {2}, 76: {112, 113, 114}, 83: {9}, 98: {2}, 99: {112, 113, 114},
               106: {9}, 119: {112, 113, 114}, 120: {2}, 121: {2}, 144: {21}, 155: {57}, 174: {2}, 188: {13},
               226: {43}, 227: {43}, 255: {2}, 256: {2}}
BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ'
BASMALA_RE = re.compile(r'بسم الله الرَّحْمَنِ الرَّحِيمِ')
MARKS = re.compile('[ً-ٰٟۖ-ۭـࣰ-ࣿ]')
DIGITS = str.maketrans('0123456789', '٠١٢٣٤٥٦٧٨٩')


def skel(w):
    """Остов слова: без огласовок и долгих гласных — одинаков в обычной орфографии и в усмани"""
    w = re.sub('[^ء-يٱ]', '', MARKS.sub('', w))
    for a, b in (('ٱ', 'ا'), ('أ', 'ا'), ('إ', 'ا'), ('آ', 'ا'), ('ى', 'ي'), ('ة', 'ه'), ('ؤ', 'و'), ('ئ', 'ي'), ('ء', '')):
        w = w.replace(a, b)
    # долгие гласные убираем, кроме первой буквы: «يسبح» и «ويسبح» — разные слова
    return re.sub(r'(.)\1+', r'\1', w[:1] + re.sub('[اوي]', '', w[1:]))


Q = []  # (остов, слово, сура, аят, номер слова, слов в аяте)
for s in range(1, 115):
    for ay in json.load(open(os.path.join(ROOT, 'quran', f'{s:03}.json'), encoding='utf8'))['ayahs']:
        ws = [w for w in ay['w'] if skel(w)]
        Q += [(skel(w), w, s, ay['n'], i, len(ws)) for i, w in enumerate(ws)]
N = 4
grams = {}
for i in range(len(Q) - N + 1):
    grams.setdefault(tuple(q[0] for q in Q[i:i + N]), []).append(i)


def uthmani(qi, L):
    out, full = [], False
    for q in Q[qi:qi + L]:
        out.append(q[1].replace('۞', '').strip())
        full = full or q[4] == 0  # аят взят с начала
        # знак конца аята — только если аят приведён целиком
        if full and q[4] == q[5] - 1: out.append('۝' + str(q[3]).translate(DIGITS)); full = False
    # аят приведён не до конца — знак остановки в конце не нужен
    return re.sub(r'[\sۖ-ۜ۞-ۭ]+$', '', ' '.join(out))


path = os.path.join(ROOT, 'azkar.json')
az = json.load(open(path, encoding='utf8'))
for k in sorted(QURAN_ITEMS):
    v = az['items'][str(k)]
    ar = BASMALA_RE.sub(BASMALA, v['ar'])
    # в базе «وَ النَّاسِ» (114:6) и «يَا أَيُّهَا» раздельно, в мусхафе — одним словом
    ar = re.sub('(?<=\\s)وَ\\s+', 'وَ', re.sub('\\s*\\*\\s*', ' * ', ar))
    ar = re.sub('يَا\\s+أَيُّهَا', 'يَاأَيُّهَا', ar)
    toks = [(m.start(), m.end(), skel(m.group())) for m in re.finditer(r'\S+', ar)]
    toks = [t for t in toks if t[2]]
    i, spans = 0, []
    while i <= len(toks) - N:
        best = None
        for qi in grams.get(tuple(t[2] for t in toks[i:i + N]), []):
            if Q[qi][2] not in QURAN_ITEMS[k]: continue
            L = N
            while i + L < len(toks) and qi + L < len(Q) and toks[i + L][2] == Q[qi + L][0]: L += 1
            if not best or L > best[1]: best = (qi, L)
        if best and best[1] >= 5:
            spans.append((i, *best)); i += best[1]
        else: i += 1
    for ti, qi, L in reversed(spans):
        a, b = toks[ti][0], toks[ti + L - 1][1]
        b += re.match('(\\s*۝[٠-٩]+)*', ar[b:]).end()  # знак аята от прошлого запуска
        # знаки вокруг (﴿ ﴾ , .) оставляем на месте, заменяем только слова
        lead = re.match(r'^[^ء-يٱ]*', ar[a:b]).group()
        tail = re.search(r'[^ء-يٱً-ٰٟ]*$', ar[a:b]).group()
        tail = re.sub('^[*,،\\sۖ-ۭ٠-٩]+', '', tail)  # и старые знаки аятов при повторном запуске
        ar = ar[:a] + lead + uthmani(qi, L) + tail + ar[b:]
        print(k, f'{Q[qi][2]}:{Q[qi][3]}–{Q[qi + L - 1][3]}', L, 'слов')
    # скобки ﴿ ﴾ вокруг целых аятов не нужны — есть знаки конца аята, а скобка налезает на последний
    ar = re.sub('﴿([^﴾]*۝[^﴾]*)﴾', r'\1', ar)
    v['ar'] = re.sub(r'(۝[٠-٩]+)\s*[*.]', r'\1', ar)
json.dump(az, open(path, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
