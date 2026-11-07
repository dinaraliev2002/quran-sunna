"""
Аяты в азкарах — буква в букву как в мусхафе приложения (public/data/quran).

В базе «Крепости мусульманина» аяты набраны обычной орфографией (без мадды, «السموات» вместо «ٱلسَّمَـٰوَٰتِ» и т. п.).
Здесь для каждого места, где в азкаре читается Коран, явно указано, какой это аят и с какого по какое слово он приведён.
Текст берётся из файла суры, а не угадывается: раньше поиск был «на глаз» и пропускал короткие отрывки.

Правила:
  • весь аят — со знаком конца аята ۝; отрывок без конца аята — без знака и без знака паузы в конце;
  • отрывок с середины аята: у первого слова снимаем шадду, появившуюся из-за слияния с предыдущим словом
    (в 21:87 «أَن لَّآ» → в мольбе «لَآ»), и знак начала части ۞;
  • коранический отрывок внутри хадиса берём в скобки ﴿ ﴾, целые аяты со знаком ۝ — без скобок (скобка налезает на знак);
  • слова хадиса, которые лишь похожи на аят (например, «وجهت وجهي…» в дуа аль-истифтах), не трогаем —
    так они приведены и в самой книге.

Аяты не хранятся в азкаре буквами: в поле «ap» азкар разбит на части — обычный текст хадиса и ссылки на мусхаф
(страница + глифы шрифта страницы из public/data/quran, поле «g»). Приложение рисует их тем же шрифтом мусхафа,
что и раздел Корана, — без перекодировки огласовок. Поле «ar» (буквами) остаётся для копирования и поиска.

Если какой-то отрывок не нашёлся в тексте азкара — скрипт останавливается с ошибкой (ничего не пропускаем молча).
Повторный запуск ничего не портит.  Запуск после build-azkar.py:  python scripts/azkar-quran.py
"""
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')

# (сура, аят с, слово с, аят по, слово по) — слова с нуля, включительно; None — до конца аята
BASM = (1, 1, 0, 1, None)
IKHLAS, FALAQ, NAS = (112, 1, 0, 4, None), (113, 1, 0, 5, None), (114, 1, 0, 6, None)
KURSI = (2, 255, 0, 255, None)
THREE = [BASM, IKHLAS, BASM, FALAQ, BASM, NAS]

# номер азкара → отрывки по порядку; 'wrap' — взять в скобки ﴿ ﴾
PASSAGES = {
    4: [(3, 190, 0, 200, None)],  # при пробуждении: Аль Имран 190–200
    50: [((23, 14, 17, 14, None), 'wrap')],  # земной поклон при чтении: «فتبارك الله أحسن الخالقين»
    70: THREE, 76: THREE, 99: THREE, 119: THREE,  # три последние суры
    71: [KURSI], 75: [KURSI], 98: [KURSI], 120: [KURSI],  # аят аль-Курси
    83: [(9, 129, 3, 129, None)], 106: [(9, 129, 3, 129, None)],  # «حسبي الله لا إله إلا هو…»
    121: [(2, 285, 0, 286, None)],  # два последних аята аль-Бакары
    # «الم» тензиль и «تبارك الذي بيده الملك» — здесь это названия сур, поэтому без знака конца аята
    130: [((32, 1, 0, 1, 0), 'wrap', 'nomark'), ((67, 1, 0, 1, 3), 'wrap')],
    144: [(21, 87, 14, 87, None)],  # мольба Юнуса
    148: [(3, 173, 13, 173, None)],  # «حسبنا الله ونعم الوكيل»
    155: [(57, 3, 0, 3, None)],  # «هو الأول والآخر…»
    174: [(2, 156, 5, 156, None)],  # «إنا لله وإنا إليه راجعون»
    # гром: «سبحان الذي يسبح الرعد…» (слова Ибн аз-Зубайра; «يسبح» у него без «و», пишется одинаково)
    188: [(13, 13, 1, 13, 5)],
    226: [(43, 13, 11, 14, None)], 227: [(43, 13, 11, 14, None)],  # «سبحان الذي سخر لنا هذا…»
    255: [(2, 201, 3, 201, None)],  # «ربنا آتنا في الدنيا حسنة…»
    256: [((2, 158, 0, 158, 5), 'wrap')],  # «إن الصفا والمروة من شعائر الله»
}
# перед аятом аль-Курси утром и вечером — «أعوذ بالله من الشيطان الرجيم», как в книге
ISTIADHA = 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ'
ISTIADHA_ITEMS = (75, 98)

MARKS = re.compile('[ً-ٰٟۖ-ۭـࣰ-ࣿ]')
DIGITS = str.maketrans('0123456789', '٠١٢٣٤٥٦٧٨٩')
TOKEN = re.compile(r'[^\s﴿﴾()\[\]*,،.؛]+')


def skel(w):
    """Остов слова: без огласовок и долгих гласных — одинаков в обычной орфографии и в усмани"""
    w = re.sub('[^ء-يٱ]', '', MARKS.sub('', w))
    for a, b in (('ٱ', 'ا'), ('أ', 'ا'), ('إ', 'ا'), ('آ', 'ا'), ('ى', 'ي'), ('ة', 'ه'), ('ؤ', 'و'), ('ئ', 'ي'), ('ء', '')):
        w = w.replace(a, b)
    return re.sub(r'(.)\1+', r'\1', w[:1] + re.sub('[اوي]', '', w[1:]))


_cache = {}


def ayah(s, n):
    if s not in _cache:
        _cache[s] = {a['n']: a for a in json.load(open(os.path.join(ROOT, 'quran', f'{s:03}.json'), encoding='utf8'))['ayahs']}
    return _cache[s][n]


def ayah_words(s, n):
    return ayah(s, n)['w']


def glyphs(p, mark=True):
    """Тот же отрывок глифами мусхафа: [[страница, глифы], …] — по аяту"""
    s, a1, w1, a2, w2 = p
    out = []
    for n in range(a1, a2 + 1):
        a = ayah(s, n)
        page, g = mushaf_glyphs(a['p'], f'{s}:{n}')
        if len(g) != len(a['w']) + 1:
            sys.exit(f'{s}:{n}: глифов {len(g)}, слов {len(a["w"])} — данные мусхафа не сходятся')
        lo = w1 if n == a1 else 0
        hi = (len(a['w']) - 1 if w2 is None else w2) if n == a2 else len(a['w']) - 1
        part = g[lo:hi + 1]
        if lo == 0 and hi == len(a['w']) - 1 and mark and p != BASM: part.append(g[-1])  # знак конца аята с номером
        out.append([page, ' '.join(part)])
    return out


_pages = {}


def mushaf_glyphs(p, key):
    """Глифы аята со страницы мусхафа (public/data/mushaf): слова по порядку и последним — знак конца аята"""
    if p not in _pages:
        d = json.load(open(os.path.join(ROOT, 'mushaf', f'{p:03}.json'), encoding='utf8'))
        _pages[p] = [e for ln in sorted(d['lines'], key=int) for e in d['lines'][ln] if isinstance(e, list)]
    g = [e[0] for e in _pages[p] if e[1] == key]
    return p, g


def passage(p, mark=True):
    """Слова отрывка (как в мусхафе) и готовый текст со знаками конца аятов"""
    s, a1, w1, a2, w2 = p
    words, out = [], []
    for n in range(a1, a2 + 1):
        ws = ayah_words(s, n)
        lo = w1 if n == a1 else 0
        hi = (len(ws) - 1 if w2 is None else w2) if n == a2 else len(ws) - 1
        part = [w.replace('۞', '').strip() for w in ws[lo:hi + 1]]
        words += part
        out += part
        if lo == 0 and hi == len(ws) - 1 and mark and p != BASM: out.append('۝' + str(n).translate(DIGITS))
    if w1 > 0:  # начали с середины аята: шадда слияния с предыдущим словом не нужна
        out[0] = re.sub('^(.)ّ', r'\1', out[0])
    text = ' '.join(out)
    # отрывок кончается не на конце аята — знак паузы в конце не нужен
    text = re.sub(r'\s*[ۖ-ۜ]+$', '', text)
    return [skel(w) for w in words if skel(w)], text


def apply(ar, k, spec, wrap, mark, start):
    want, text = passage(spec, mark)
    toks = [(m.start(), m.end(), skel(m.group())) for m in TOKEN.finditer(ar)]
    toks = [t for t in toks if t[2] and t[0] >= start]
    for i in range(len(toks) - len(want) + 1):
        if [t[2] for t in toks[i:i + len(want)]] == want:
            a, b = toks[i][0], toks[i + len(want) - 1][1]
            b += re.match(r'(\s*[ۖ-ۜ])?(\s*۝[٠-٩]+)*', ar[b:]).end()  # знаки от прошлого запуска
            if a and ar[a - 1] in '﴿(': a -= 1
            if b < len(ar) and ar[b] in '﴾)': b += 1
            new = '' + text + ''  # метки границ отрывка — потом здесь будет ссылка на мусхаф
            new = f'﴿{new}﴾' if wrap else new
            return ar[:a] + new + ar[b:], a + len(new)
    sys.exit(f'Азкар {k}: не нашёлся отрывок {spec} — проверьте текст азкара')


def main():
    path = os.path.join(ROOT, 'azkar.json')
    az = json.load(open(path, encoding='utf8'))
    for k, specs in sorted(PASSAGES.items()):
        v = az['items'][str(k)]
        ar = v['ar']
        # в базе «وَ النَّاسِ» (114:6) раздельно, в мусхафе — одним словом
        ar = re.sub('(?<=\\s)وَ\\s+(?=النَّاسِ)', 'وَ', ar)
        pos = 0
        qs = []
        for sp in specs:
            spec, opts = (sp[0], sp[1:]) if isinstance(sp[0], tuple) else (sp, ())
            ar, pos = apply(ar, k, spec, 'wrap' in opts, 'nomark' not in opts, pos)
            q = {'q': glyphs(spec, 'nomark' not in opts)}
            if spec == BASM: q['b'] = 1  # басмала — отдельной строкой
            qs.append(q)
        if k in ISTIADHA_ITEMS and not ar.startswith(ISTIADHA):
            ar = ISTIADHA + ' ' + ar
        ar = re.sub(r'(۝[٠-٩]+?)\s*[*.]', r'\1', re.sub(r'[ \t]+', ' ', ar)).strip()
        # части по порядку: текст хадиса и ссылки на мусхаф (между метками … — отрывок буквами)
        bits = re.split(r'[^]*', ar)
        if len(bits) != len(qs) + 1:
            sys.exit(f'Азкар {k}: части не сошлись')
        ap = []
        for i, b in enumerate(bits):
            if b.strip(): ap.append(b.strip(' '))
            if i < len(qs): ap.append(qs[i])
        v['ap'] = ap
        v['ar'] = ar.replace('', '').replace('', '')
        print(k, 'готово')
    json.dump(az, open(path, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
