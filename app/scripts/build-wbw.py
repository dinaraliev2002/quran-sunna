# Пословный перевод на русский: плоский список из 77 429 слов (по порядку слов Корана) -> по сурам и аятам.
# Вход: файл ru-quranwbw.json (ключи "1".."77429"). Выход: public/data/wbw/NNN.json — для каждого аята список подписей к словам.
# Пустая подпись: слово переведено вместе с соседним ([[MISSING]] в исходном файле).
import json, glob, os, re, sys
SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
new = json.load(open(SRC, encoding='utf-8'))
LAT = str.maketrans('CcAKaeopxyH', 'СсАКаеорхуН')  # латинские буквы, похожие на русские, внутри русских слов
FIX = {'знащий': 'знающий', 'горничных (з`рен)': 'горчичных (зерен)'}
OVERRIDE = {(23, 112, 4): 'земле'}  # в исходном файле здесь повтор «на»
os.makedirs(os.path.join(ROOT, 'public/data/wbw'), exist_ok=True)
n = 0; miss = 0
for s in range(1, 115):
    ayahs = json.load(open(os.path.join(ROOT, f'public/data/quran/{s:03d}.json'), encoding='utf-8'))['ayahs']
    out = []
    for ai, a in enumerate(ayahs, 1):
        row = []
        for wi in range(len(a['w'])):
            n += 1
            t = new[str(n)]
            if t == '[[MISSING]]': row.append(''); miss += 1; continue
            t = t.replace('\xad', '').replace('`', '').strip()
            if re.search(r'[А-Яа-яЁё]', t) or re.fullmatch(r'[A-Za-z]', t): t = t.translate(LAT)
            t = re.sub(r'^/|/$', '', t) if t != '/' else t
            t = FIX.get(t, t)
            row.append(OVERRIDE.get((s, ai, wi), t))
        out.append(row)
    json.dump(out, open(os.path.join(ROOT, f'public/data/wbw/{s:03d}.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
assert n == len(new), (n, len(new))
print('слов', n, 'без подписи', miss)
