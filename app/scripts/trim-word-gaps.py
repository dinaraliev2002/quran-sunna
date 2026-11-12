"""Начало слова — там, где слово реально зазвучало, а не сразу после предыдущего слова.

В разметке Quran.com слово длится до начала следующего, поэтому при долгой паузе (учебное чтение аль-Хусари: шейх
читает кусок и ждёт, пока повторят) следующее слово подсвечивается уже в начале паузы, за секунды до звука.
Здесь: если от начала слова до первого звука больше GAP мс, начало переносим на 30 мс раньше звука,
а конец предыдущего слова — на 60 мс после его последнего звука. Границы аятов (a) не трогаем.

  python -I scripts/trim-word-gaps.py <чтец> <суры: 1,2 | all> [--write] [--cache DIR]
"""
import json, os, sys, zlib
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
_spec = importlib.util.spec_from_file_location('refine_boundaries', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'refine-boundaries.py'))
rb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rb)
al = rb.al

GAP = 400      # пауза перед словом, мс, с которой переносим начало
RANGE_DB = 35  # звук — всё не тише пика на столько дБ


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    write = '--write' in sys.argv
    cache = sys.argv[sys.argv.index('--cache') + 1] if '--cache' in sys.argv else 'D:/recite-cache'
    if '--cache' in sys.argv:
        args.remove(cache)
    rec, which = args[0], args[1]
    index = json.load(open(os.path.join(al.OUT, 'index.json'), encoding='utf-8'))
    surahs = range(1, 115) if which == 'all' else [int(x) for x in which.split(',')]
    os.makedirs(os.path.join(cache, rec), exist_ok=True)
    total = moved = 0
    for s in surahs:
        path = os.path.join(al.OUT, rec, f'{s:03d}.json')
        if not os.path.exists(path):
            continue
        cur = json.load(open(path, encoding='utf-8'))
        if not cur.get('w'):
            continue
        url = index[rec]['u'][s - 1]
        # файлы, скачанные прежними скриптами, лежат под двумя именами — берём любое готовое
        cands = [os.path.join(cache, rec, f'full{s:03d}-{zlib.crc32(url.encode())}.mp3'), os.path.join(cache, rec, f'w{s:03d}.mp3')]
        fp = next((c for c in cands if os.path.exists(c) and os.path.getsize(c) > 0), cands[0])
        full = al.load(url, fp)
        if len(full) < al.SR:
            print(f'{rec} {s}: запись не скачалась')
            continue
        db = rb.energy_db(full)
        voiced = db > db.max() - RANGE_DB
        n = len(voiced)
        for words in cur['w']:
            for i, x in enumerate(words):
                total += 1
                st, en = x[1], x[2]
                a, b = st // 10, min(n, en // 10)
                if b - a < GAP // 10:
                    continue
                hit = np.nonzero(voiced[a:b])[0]
                if len(hit) == 0 or hit[0] * 10 < GAP:
                    continue
                new = st + int(hit[0]) * 10 - 30
                x[1] = new
                moved += 1
                if i > 0:
                    prev = words[i - 1]
                    pa, pb = prev[1] // 10, min(n, st // 10)
                    ph = np.nonzero(voiced[pa:pb])[0]
                    if len(ph):
                        prev[2] = min(prev[2], prev[1] + int(ph[-1]) * 10 + 60)
        if write:
            json.dump(cur, open(path, 'w', encoding='utf-8'), separators=(',', ':'))
    print(f'{rec}: слов {total}, начало перенесено у {moved} ({100 * moved / max(total, 1):.1f}%)')


if __name__ == '__main__':
    main()
