"""Уточнение границ аятов в разметке цельной записи (public/data/recite/<чтец>/NNN.json).

Разметка по файлам аятов everyayah ставит границу там, где файл аята начинается, а у чтецов, читающих слитно
(Шатри), файл аята порой начинается уже после первой буквы — буква остаётся в конце предыдущего аята.
Здесь каждую границу переносим в самое тихое место перед началом голоса (провал между словами или пауза):
окно [-300 мс, +30 мс] вокруг старой границы, порог — 4 дБ над самым тихим кадром, граница — за 40 мс до того,
как голос поднимается.

  python -I scripts/refine-boundaries.py <чтец> <суры: 55,2 | all> [--write] [--cache DIR]

Без --write печатает, насколько сдвинулись границы. Слова (w) не трогаем: их время считается от своих меток.
"""
import json, os, sys, tempfile, zlib
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
_spec = importlib.util.spec_from_file_location('align_recitation', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'align-recitation.py'))
al = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(al)

SR = al.SR
FRAME = SR // 100  # 10 мс
BACK, FWD, ZONE_DB, MARGIN = 300, 30, 4.0, 40


def energy_db(x):
    n = len(x) // FRAME
    e = (x[:n * FRAME].reshape(n, FRAME) ** 2).mean(1)
    e = np.convolve(e, np.ones(2) / 2, 'same')  # сглаживание ~20 мс
    return 10 * np.log10(e + 1e-10)


def refine(full_db, b_ms):
    """Новая граница (мс) рядом со старой b_ms"""
    lo = max(0, (b_ms - BACK) // 10)
    hi = min(len(full_db), (b_ms + FWD) // 10 + 1)
    seg = full_db[lo:hi]
    if len(seg) < 4:
        return b_ms
    zone = np.nonzero(seg <= seg.min() + ZONE_DB)[0]
    last = int(zone[-1]) + lo  # последний «тихий» кадр: сразу за ним поднимается голос
    return max(0, last * 10 - MARGIN)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    write = '--write' in sys.argv
    cache = sys.argv[sys.argv.index('--cache') + 1] if '--cache' in sys.argv else os.path.join(tempfile.gettempdir(), 'recite-refine')
    if '--cache' in sys.argv:
        args.remove(cache)
    rec, which = args[0], args[1]
    index = json.load(open(os.path.join(al.OUT, 'index.json'), encoding='utf-8'))
    surahs = range(1, 115) if which == 'all' else [int(x) for x in which.split(',')]
    os.makedirs(os.path.join(cache, rec), exist_ok=True)
    for s in surahs:
        path = os.path.join(al.OUT, rec, f'{s:03d}.json')
        if not os.path.exists(path):
            continue
        cur = json.load(open(path, encoding='utf-8'))
        url = index[rec]['u'][s - 1]
        fp = os.path.join(cache, rec, f'full{s:03d}-{zlib.crc32(url.encode())}.mp3')
        full = al.load(url, fp)
        if len(full) < SR:
            print(f'{rec} {s}: запись не скачалась, пропускаю')
            continue
        db = energy_db(full)
        a = cur['a']
        new = [list(x) for x in a]
        shifts = []
        for i in range(1, len(a)):
            nb = refine(db, a[i][0])
            if nb < a[i - 1][0] + 300:  # аят не короче 0,3 с
                continue
            shifts.append(a[i][0] - nb)
            new[i][0] = nb
            new[i - 1][1] = nb if abs(a[i - 1][1] - a[i][0]) < 5 else a[i - 1][1]
        print(f'{rec} {s}: сдвинуто {sum(1 for x in shifts if x)} из {len(shifts)}, сдвиг до {max(shifts, default=0)} мс, в среднем {int(np.mean(shifts)) if shifts else 0} мс')
        if write:
            cur['a'] = new
            json.dump(cur, open(path, 'w', encoding='utf-8'), separators=(',', ':'))
        if '--clean' in sys.argv and os.path.exists(fp):
            os.remove(fp)


if __name__ == '__main__':
    main()
