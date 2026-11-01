# Цепочки для хадисов ан-Навави и «Рияд ас-Салихин»: по ссылкам в тексте («аль-Бухари 8, Муслим 16»)
# находим тот же хадис в первоисточнике и берём его цепочку.
# Проверки: (1) арабский текст совпадает; (2) сподвижник цепочки назван в начале хадиса
# (или совпадает с уже установленным сподвижником; для «وعنه» — с сподвижником предыдущего хадиса).
import sqlite3, json, io, os, re, collections
SP = r'C:\Users\emila\AppData\Local\Temp\claude\C--Users-emila-Desktop--------------\5959476b-34e5-4457-99e3-f324264f98bf\scratchpad'
H = r'C:\Users\emila\Desktop\коран и сунна\app\public\data\hadith'
N = r'C:\Users\emila\Desktop\коран и сунна\app\public\data\narrators'
con = sqlite3.connect('file:' + SP + r'\hkg\hadith-kg.db?mode=ro', uri=True)
log = io.open(SP + r'\hkg_scripts\link_build.txt', 'w', encoding='utf-8')

def norm(s):
    s = re.sub(r'[\u064B-\u0652\u0670\u0640\u06D6-\u06ED]', '', s or '')
    s = s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ٱ', 'ا').replace('ى', 'ي').replace('ة', 'ه')
    s = re.sub(r'[^\u0621-\u064A ]', ' ', s)
    return s.split()
def bare(t): return t[2:] if t.startswith('ال') and len(t) > 3 else t
def tri(w): return {' '.join(w[k:k + 3]) for k in range(len(w) - 2)}

BOOKS = {'bukhari': 1, 'muslim': 2, 'tirmidhi': 3, 'abudawud': 4, 'nasai': 5, 'ibnmajah': 6, 'darimi': 7, 'malik': 8}
REF = [('bukhari', r'аль-Бухари'), ('muslim', r'Муслим'), ('tirmidhi', r'ат-Тирмизи'), ('abudawud', r'Абу Дау?д'),
       ('nasai', r'ан-Наса[иа]и'), ('ibnmajah', r'Ибн Мадж[аж]х?'), ('darimi', r'ад-Дарими'), ('malik', r'Малик')]

post = collections.defaultdict(list)
meta = {}
for hid, b, no, nass in con.execute('select id, book_id, no_inbook, nass from hadiths where book_id between 1 and 8'):
    t = tri(norm(nass))
    meta[hid] = (b, str(no), len(t))
    for g in t: post[g].append(hid)

def cands_of(ar, books):
    t = tri(norm(ar))
    if len(t) < 5: return []
    c = collections.Counter()
    for g in t:
        p = post.get(g)
        if p and len(p) < 4000:
            for hid in p:
                if meta[hid][0] in books: c[hid] += 1
    return [(hid, v / len(t)) for hid, v in c.most_common(60)]

def mcov(hid, it):
    nass, ms, me = con.execute('select nass, matn_start, matn_end from hadiths where id=?', (hid,)).fetchone()
    if ms is None or not me or me <= ms: return None
    t = tri(norm(nass[ms:me]))
    return len(t & it) / len(t) if len(t) >= 3 else None

def chain_of(hid):
    r = con.execute('select id from sanads where hadith_id=? order by id limit 1', (hid,)).fetchone()
    if not r: return None
    ch = [x[0] for x in con.execute('select rawi_id from sanad_rawis where sanad_id=? order by pos', (r[0],))]
    return ch if len(ch) >= 3 else None

STOP = {'ابن', 'ابو', 'ابي', 'ام', 'عبد', 'بنت', 'عن', 'رضي', 'له', 'عنه', 'عنها', 'عنهما', 'قال', 'ان', 'نبي', 'رسول'}
ALIAS = {720: {'انس'}, 4396: {'هريره'}, 5913: {'عمر'}, 4967: {'عمر'}, 4049: {'عائشه'}, 8101: {'عبيد'}}
_kw = {}
def keyw(rid):
    if rid not in _kw:
        r = con.execute('select name, nickname from rawis where id=?', (rid,)).fetchone() or ('', '')
        w = {bare(t) for s in r for t in norm(s) if len(t) >= 2} - STOP
        _kw[rid] = w | ALIAS.get(rid, set())
    return _kw[rid]
def named(rid, head): return bool(keyw(rid) & head)

def items(coll):
    for f in sorted(os.listdir(os.path.join(H, coll)), key=lambda s: int(s.split('.')[0])):
        bn = int(f.split('.')[0])
        for i, x in enumerate(json.load(io.open(os.path.join(H, coll, f), encoding='utf-8'))['items']): yield bn, i, x
appidx = {c: {} for c in ('bukhari', 'muslim')}
for c in appidx:
    for bn, i, x in items(c):
        if x.get('h'): appidx[c].setdefault(str(x['h']), f'{bn}:{i}')
appch = {c: json.load(io.open(os.path.join(N, f'chains-{c}.json'), encoding='utf-8')) for c in appidx}
fin = json.load(io.open(SP + r'\hkg_scripts\final2.json', encoding='utf-8'))['chain']
sah = json.load(io.open(SP + r'\hkg_scripts\sahabi_tiers.json', encoding='utf-8'))
# ручные указания (ан-Навави 1: номера в тексте не приведены — аль-Бухари 1, Муслим 1907)
MANUAL = {('nawawi', 1, 0): [('bukhari', '1'), ('muslim', '1907')]}

out = {'nawawi': {}, 'riyad': {}}
for coll in out:
    st = collections.Counter()
    prev = None; prevbn = None
    for bn, i, x in items(coll):
        if bn != prevbn: prev = None; prevbn = bn
        ru = ' '.join(x.get('ru') or []); ar = ' '.join(x.get('ar') or [])
        if not ar.strip() or not re.search(r'[«“]', ru): continue
        st['хадисов'] += 1
        hw = [bare(t) for t in norm(ar)[:30]]
        head = set(hw)
        pron = any(t in ('عنه', 'عنها', 'وعنه', 'وعنها') for t in hw[:3])   # «и от него же»
        known = sah.get(f'{coll}/{bn}.json#{i}', {}).get('rawi')
        def sahabi_ok(r):
            if named(r, head): return True
            if known and r == known: return True
            return pron and prev is not None and r == prev
        refs = MANUAL.get((coll, bn, i)) or [(code, n) for code, pat in REF for n in re.findall(pat + r'[^0-9()«»]{0,12}?(\d+)', ru)]
        if not refs: st['без ссылок'] += 1; prev = known or prev; continue
        cands = cands_of(ar, {BOOKS[c] for c, _ in refs})
        itri = tri(norm(ar))
        score = dict(cands)
        pick = None
        for code, n in refs:
            b = BOOKS[code]
            if code in appch:
                ak = appidx[code].get(n)
                if ak in appch[code]:
                    hid = fin.get(f'{code}/{ak.split(":")[0]}.json#{ak.split(":")[1]}')
                    ch = appch[code][ak]
                    if hid and score.get(hid, 0) >= 0.15 and (mcov(hid, itri) or 0) >= 0.35 and sahabi_ok(ch[-1]):
                        pick = (code, n, ch, 'app'); break
            for h, s in cands:
                if meta[h][0] != b or s < (0.2 if coll == 'nawawi' else 0.4): continue
                if code == 'bukhari' and meta[h][1] != n and s < 0.7: continue
                mc = mcov(h, itri)
                if mc is None or mc < 0.5: continue
                ch = chain_of(h)
                if ch and sahabi_ok(ch[-1]): pick = (code, n, ch, f'{s:.2f} hid={h}'); break
            if pick: break
        if not pick:
            st['не найдено'] += 1
            if coll == 'nawawi':
                top = [(meta[h][0], meta[h][1], round(s, 2)) for h, s in cands[:5]]
                print('НЕ НАЙДЕНО навави', i + 1, refs, top, file=log)
            prev = known or prev
            continue
        code, n, ch, how = pick
        out[coll][f'{bn}:{i}'] = [code, n, ch]
        if coll == 'nawawi':
            nm = con.execute('select nickname from rawis where id=?', (ch[-1],)).fetchone()[0]
            print('НАВАВИ', i + 1, x['t'][:40], '|', code, n, how, '| сподвижник:', nm, '| звеньев', len(ch), file=log)
            if how != 'app': print('    ', con.execute('select substr(nass,1,700) from hadiths where id=?', (int(how.split('hid=')[1]),)).fetchone()[0], file=log)
        prev = ch[-1]
        st[f'найдено ({code})'] += 1
        st['проверено приложением' if how == 'app' else 'по тексту'] += 1
        if how != 'app' and coll == 'riyad' and float(how.split()[0]) < 0.5: st['riyad 0.4-0.5'] += 1
    print(coll, dict(st), file=log)
io.open(SP + r'\hkg_scripts\links.json', 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False))
