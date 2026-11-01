import sqlite3, io, re, json, os, collections
SP = r'C:\Users\emila\AppData\Local\Temp\claude\C--Users-emila-Desktop--------------\5959476b-34e5-4457-99e3-f324264f98bf\scratchpad'
OUT = r'C:\Users\emila\Desktop\коран и сунна\app\public\data\narrators'
os.makedirs(OUT, exist_ok=True)
con = sqlite3.connect('file:' + SP + r'\hkg\hadith-kg.db?mode=ro', uri=True)
fin = json.load(io.open(SP + r'\hkg_scripts\final2.json', encoding='utf-8'))['chain']

chains = {}
used = set()
for k, hid in fin.items():
    if not k.startswith('bukhari/'): continue
    f, i = k.split('/')[1].split('#')
    bn = f.replace('.json', '')
    r = con.execute('select id from sanads where hadith_id=? order by id limit 1', (hid,)).fetchone()
    if not r: continue
    ch = [x[0] for x in con.execute('select rawi_id from sanad_rawis where sanad_id=? order by pos', (r[0],))]
    if not ch: continue
    chains[f'{bn}:{i}'] = ch
    used.update(ch)
print('цепочек', len(chains), 'передатчиков', len(used))

# критики: короткое имя
alems = {}
for aid, name, nick, shuhra, laqab, qty in con.execute('select id,name,nickname,shuhra,laqab,aqwal_qty from alems'):
    short = shuhra or nick or ' '.join((name or '').split()[:3])
    alems[aid] = (short, qty or 0, name or '')

def clean(q):
    return re.sub(r'\s+', ' ', (q or '')).strip()

narr = {}
for rid in sorted(x for x in used if x):
    r = con.execute('select id,name,nickname,rank,rank_no,tabaka,death_year,death_year_raw,riwaya_qty,has_tadlis,has_ikhtilat,is_stub from rawis where id=?', (rid,)).fetchone()
    if not r: continue
    _, name, nick, rank, rno, tab, dy, dyr, rq, tadlis, ikht, stub = r
    taqrib = None
    quotes = []
    for aid, qawl in con.execute('select alem_id,qawl from aqwal where rawi_id=?', (rid,)):
        a = alems.get(aid)
        q = clean(qawl)
        if not a or not q: continue
        if 'قال في التقريب' in q and taqrib is None:
            taqrib = clean(q.replace('قال في التقريب', ''))
            continue
        quotes.append((a[1], a[0], q[:160]))
    quotes.sort(reverse=True)
    narr[str(rid)] = {
        'n': name, 'k': nick, 'r': rank, 'rn': rno, 't': tab, 'd': dy, 'q': rq,
        **({'tz': 1} if tadlis else {}), **({'ik': 1} if ikht else {}), **({'st': 1} if stub else {}),
        **({'tq': taqrib[:200]} if taqrib else {}),
        **({'c': [[a, q] for _, a, q in quotes[:4]]} if quotes else {}),
    }

io.open(OUT + r'\chains-bukhari.json', 'w', encoding='utf-8').write(json.dumps(chains, ensure_ascii=False, separators=(',', ':')))
io.open(OUT + r'\n.json', 'w', encoding='utf-8').write(json.dumps(narr, ensure_ascii=False, separators=(',', ':')))
print('размеры', os.path.getsize(OUT + r'\chains-bukhari.json'), os.path.getsize(OUT + r'\n.json'))
c = collections.Counter(v['r'] for v in narr.values())
io.open(SP + r'\hkg_scripts\ranks.txt', 'w', encoding='utf-8').write('\n'.join(f'{n} {r}' for r, n in c.most_common(60)))
