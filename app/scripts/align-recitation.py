"""Разметка аятов в цельной записи суры по файлам аятов того же чтеца (everyayah.com).

Если запись суры и файлы аятов — одна и та же запись чтеца, каждый аят находится в файле суры
точно (взаимная корреляция звука). Так исправляем ошибки готовой разметки и размечаем суры, где её нет.

  python -I scripts/align-recitation.py <чтец> <папка everyayah> <суры: 14,60 | all> [--write] [--cache DIR]

all — только суры без разметки (список n), так прерванную разметку можно продолжить.
--shift-words: в public/data/recite/<чтец>/ лежит разметка склейки Quran.com (аяты и слова) — слова переносятся
в сплошную запись (адрес в index.json), по месту каждого файла аята.
Без --write только сравнивает с текущей разметкой в public/data/recite/<чтец>/ и печатает расхождения.
Нужен ffmpeg. Совпадение ниже 0.8 — запись другая; такой аят не трогаем и сообщаем.
"""
import json, os, subprocess, sys, tempfile, urllib.request, zlib
from concurrent.futures import ThreadPoolExecutor
import numpy as np

SR = 8000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'data', 'recite')
UA = {'User-Agent': 'Mozilla/5.0 (quran-sunna build script)'}


def fetch(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r, open(path + '.part', 'wb') as f:
                while True:
                    b = r.read(1 << 20)
                    if not b:
                        break
                    f.write(b)
            os.replace(path + '.part', path)
            return path
        except Exception as e:  # noqa: BLE001
            if attempt == 3:
                raise
    return path


def pcm(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def ncc_search(full, clip, lo, hi):
    """Лучшее место clip в full[lo:hi] (нормированная корреляция)"""
    lo = max(0, lo)
    hi = min(len(full), hi)
    seg = full[lo:hi]
    if len(seg) < len(clip):
        return lo, 0.0
    n = len(seg) + len(clip)
    N = 1 << (n - 1).bit_length()
    corr = np.fft.irfft(np.fft.rfft(seg, N) * np.fft.rfft(clip[::-1], N), N)[len(clip) - 1:len(seg)]
    cs = np.concatenate([[0], np.cumsum(seg.astype(np.float64) ** 2)])
    win = np.sqrt(np.maximum(cs[len(clip):] - cs[:-len(clip)], 1e-12))[:len(corr)]
    ncc = corr / (win * np.sqrt((clip.astype(np.float64) ** 2).sum()) + 1e-9)
    ncc[win < 1e-3] = 0  # тишина — не совпадение
    i = int(np.argmax(ncc))
    return lo + i, float(ncc[i])


def onset(x, th=0.01):
    """Первый и последний слышимый отсчёт клипа"""
    idx = np.nonzero(np.abs(x) > th)[0]
    return (int(idx[0]), int(idx[-1])) if len(idx) else (0, len(x) - 1)


def align(full, clips):
    """[(начало_мс, конец_мс)] по аятам; None, если аят не нашёлся"""
    res = []
    pos = 0
    for c in clips:
        on, off = onset(c)
        core = c[on:off + 1]
        # ищем рядом с концом прошлого аята (запас назад 3 с, вперёд — длина аята + 60 с)
        at, score = ncc_search(full, core, pos - 3 * SR, pos + len(core) + 60 * SR)
        if score < 0.6:  # не нашли рядом — ищем по всей записи (там нужно совпадение надёжнее)
            at, score = ncc_search(full, core, 0, len(full))
            if score < 0.8:
                score = 0
        if score < 0.6:
            res.append(None)
            continue
        res.append([at, at + len(core), score, at - on])  # последнее — где в записи начало файла аята
        pos = at + len(core)
    # ненайденные аяты между найденными (на everyayah этот кусок — другой дубль): промежуток между соседями
    # делим пропорционально длинам аятов, а каждую границу подтягиваем к самому тихому месту рядом (±1,5 с)
    hop = int(0.02 * SR)
    energy = np.convolve((full[:len(full) // hop * hop].reshape(-1, hop) ** 2).mean(1), np.ones(10) / 10, 'same')
    i = 0
    while i < len(res):
        if res[i] is not None:
            i += 1
            continue
        j = i
        while j < len(res) and res[j] is None:
            j += 1
        lo = res[i - 1][1] if i else 0
        hi = res[j][0] if j < len(res) else len(full)
        lens = np.array([len(c) for c in clips[i:j]], float)
        if hi > lo:
            cuts = lo + np.concatenate([[0], np.cumsum(lens)]) / lens.sum() * (hi - lo)
            for k in range(1, len(cuts) - 1):
                f = int(cuts[k] / hop)
                a, b = max(0, f - 75), min(len(energy), f + 76)
                cuts[k] = (a + int(np.argmin(energy[a:b]))) * hop
            for k in range(i, j):
                res[k] = [int(cuts[k - i]), int(cuts[k - i + 1]), 0.0, None]
            print(f'   аяты {i + 1}–{j}: не нашлись, разделены по длине и паузам')
        i = j
    out = []
    for i, r in enumerate(res):
        if r is None:
            out.append(None)
            continue
        start = max(0, r[0] - int(0.05 * SR))
        # конец — начало следующего аята (пауза-вдох остаётся в этом аяте), у последнего — +0,4 с
        nxt = res[i + 1] if i + 1 < len(res) else None
        end = nxt[0] - int(0.05 * SR) if nxt else min(len(full), r[1] + int(0.4 * SR))
        out.append([round(start * 1000 / SR), round(end * 1000 / SR), round(r[2], 3), None if r[3] is None else round(r[3] * 1000 / SR)])
    return out


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    write = '--write' in sys.argv
    cache = sys.argv[sys.argv.index('--cache') + 1] if '--cache' in sys.argv else os.path.join(tempfile.gettempdir(), 'recite-align')
    if '--cache' in sys.argv:
        args.remove(cache)
    rec, folder, which = args[0], args[1], args[2]
    counts = [s['ayahs'] for s in json.load(open(os.path.join(ROOT, 'public', 'data', 'surahs.json'), encoding='utf-8'))]
    index = json.load(open(os.path.join(OUT, 'index.json'), encoding='utf-8'))
    # all — суры, ещё не размеченные (список n в index.json): прерванную разметку можно продолжить
    surahs = list(index[rec]['n']) if which == 'all' else [int(x) for x in which.split(',')]
    os.makedirs(os.path.join(cache, rec), exist_ok=True)
    for s in surahs:
        d = os.path.join(cache, rec)
        # файлы скачиваем параллельно (их тысячи, по одному — часы); имя цельной записи — с хэшем адреса,
        # чтобы в кэше не перепутать записи разных источников
        url = index[rec]['u'][s - 1]
        full_path = os.path.join(d, f'full{s:03d}-{zlib.crc32(url.encode())}.mp3')
        jobs = [(url, full_path)] + [(f'https://everyayah.com/data/{folder}/{s:03d}{a:03d}.mp3', os.path.join(d, f'{s:03d}{a:03d}.mp3'))
                                     for a in range(1, counts[s - 1] + 1)]
        with ThreadPoolExecutor(16) as ex:
            list(ex.map(lambda j: fetch(*j), jobs))
        full = pcm(full_path)
        clips = [pcm(p) for _, p in jobs[1:]]
        got = align(full, clips)
        path = os.path.join(OUT, rec, f'{s:03d}.json')
        cur = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else None
        missing = [i + 1 for i, g in enumerate(got) if g is None]
        # больше четверти аятов не нашлось — скорее всего, это вообще другая запись: не размечаем
        guessed = sum(1 for g in got if g and g[2] == 0.0)
        if guessed > len(got) / 4:
            missing = missing or [f'угадано {guessed} из {len(got)}']
        diffs = []
        if cur:
            for i, g in enumerate(got):
                if g and abs(g[0] - cur['a'][i][0]) > 400:
                    diffs.append(f'{i + 1}: {cur["a"][i][0]}→{g[0]}')
        low = min((g[2] for g in got if g), default=0)
        print(f'{rec} {s}: аятов {len(got)}, не найдено {missing or 0}, мин. совпадение {low}, расхождений >0,4 с: {len(diffs)} {diffs[:6]}')
        if write:
            if missing:
                print(f'   не записываю: не все аяты нашлись')
                continue
            a = [[g[0], g[1]] for g in got]
            new = {'a': a}
            if cur and cur.get('w') and '--shift-words' in sys.argv:
                # слова из разметки склейки Quran.com (там аят начинается ровно с файла аята):
                # сдвигаем на то, где этот файл аята звучит в сплошной записи
                new['w'] = [[[n_, f + g[3] - cur['a'][i][0], t + g[3] - cur['a'][i][0]] for n_, f, t in w] if g[3] is not None else []
                            for i, (w, g) in enumerate(zip(cur['w'], got))]
            elif cur and cur.get('w'):
                # слова оставляем только у аятов, где граница не сдвинулась
                new['w'] = [w if abs(a[i][0] - cur['a'][i][0]) <= 400 else [] for i, w in enumerate(cur['w'])]
            json.dump(new, open(path, 'w', encoding='utf-8'), separators=(',', ':'))
            # список читаем заново: его могли поменять другие скрипты, пока шла разметка
            index = json.load(open(os.path.join(OUT, 'index.json'), encoding='utf-8'))
            if s in index[rec]['n']:
                index[rec]['n'].remove(s)
            json.dump(index, open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), separators=(',', ':'))
        if '--clean' in sys.argv:  # скачанное больше не нужно — освобождаем диск
            for f in os.listdir(d):
                if f.startswith(f'full{s:03d}') or f.startswith(f'{s:03d}'):
                    os.remove(os.path.join(d, f))


if __name__ == '__main__':
    main()
