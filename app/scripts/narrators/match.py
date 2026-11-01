import sqlite3, io, re, json, glob, collections, time, sys
SP = r'C:\Users\emila\AppData\Local\Temp\claude\C--Users-emila-Desktop--------------\5959476b-34e5-4457-99e3-f324264f98bf\scratchpad'
H = r'C:\Users\emila\Desktop\коран и сунна\app\public\data\hadith'
K = 8  # слов в отпечатке

def norm(s):
    s = re.sub(r'[\u064B-\u0652\u0670\u0640\u06D6-\u06ED]', '', s or '')
    s = s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ٱ', 'ا').replace('ى', 'ي').replace('ة', 'ه')
    s = re.sub(r'[^\u0621-\u064A ]', ' ', s)
    s = re.sub(r'\bبن\b', 'ابن', s)
    return s.split()

t0 = time.time()
con = sqlite3.connect('file:' + SP + r'\hkg\hadith-kg.db?mode=ro', uri=True)
byNass = collections.defaultdict(list)   # первые K слов хадиса целиком -> id
byMatn = collections.defaultdict(list)   # первые K слов матна -> id
n = 0
for hid, book, nass, ms, me in con.execute('select id, book_id, nass, matn_start, matn_end from hadiths'):
    w = norm(nass)
    if len(w) >= K:
        byNass[' '.join(w[:K])].append((hid, book))
    if ms is not None and me and me > ms:
        m = norm(nass[ms:me])
        if len(m) >= K:
            byMatn[' '.join(m[:K])].append((hid, book))
    n += 1
print('DB готово', n, round(time.time() - t0), 'c', file=sys.stderr)

def items_of(coll):
    for f in sorted(glob.glob(H + '\\' + coll + '\\*.json'), key=lambda p: int(re.search(r'(\d+)\.json', p).group(1))):
        d = json.load(io.open(f, encoding='utf-8'))
        for i, it in enumerate(d['items']):
            ar = ' '.join(it.get('ar') or [])
            if not ar.strip(): continue
            yield f.split('\\')[-1], i, it.get('h'), ar

res = {}
stats = {}
for coll, books in [('bukhari', {1}), ('muslim', {2}), ('nawawi', None), ('riyad', None)]:
    tot = hit = amb = 0
    for f, i, h, ar in items_of(coll):
        if coll in ('bukhari', 'muslim') and h is None: continue
        w = norm(ar)
        if len(w) < K: continue
        tot += 1
        found = []
        for p in range(0, len(w) - K + 1):
            g = ' '.join(w[p:p + K])
            if p == 0 or True:
                for hid, b in byNass.get(g, []):
                    if books is None or b in books: found.append((hid, b, 'n'))
                for hid, b in byMatn.get(g, []):
                    if books is None or b in books: found.append((hid, b, 'm'))
        if found:
            c = collections.Counter(x[0] for x in found)
            top = c.most_common(1)[0][1]
            ids = [x for x, v in c.items() if v == top][:60]
            hit += 1
            if len(ids) > 1: amb += 1
            res[f'{coll}/{f}#{i}'] = {'h': h, 'ids': ids, 'books': sorted({x[1] for x in found})[:6]}
    stats[coll] = (tot, hit, amb)
    print(coll, tot, hit, amb, file=sys.stderr)
io.open(SP + r'\hkg_scripts\match.json', 'w', encoding='utf-8').write(json.dumps(res, ensure_ascii=False))
io.open(SP + r'\hkg_scripts\match_stats.txt', 'w', encoding='utf-8').write(str(stats))
print('done', round(time.time() - t0), file=sys.stderr)
