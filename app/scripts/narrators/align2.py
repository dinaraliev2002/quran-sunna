import sqlite3, io, re, json, glob, collections
SP = r'C:\Users\emila\AppData\Local\Temp\claude\C--Users-emila-Desktop--------------\5959476b-34e5-4457-99e3-f324264f98bf\scratchpad'
H = r'C:\Users\emila\Desktop\коран и сунна\app\public\data\hadith'
m = json.load(io.open(SP + r'\hkg_scripts\match.json', encoding='utf-8'))
con = sqlite3.connect('file:' + SP + r'\hkg\hadith-kg.db?mode=ro', uri=True)

def norm(s):
    s = re.sub(r'[\u064B-\u0652\u0670\u0640\u06D6-\u06ED]', '', s or '')
    s = s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ٱ', 'ا').replace('ى', 'ي').replace('ة', 'ه')
    s = re.sub(r'[^\u0621-\u064A ]', ' ', s)
    s = re.sub(r'\bبن\b', 'ابن', s)
    return s.split()

def grams(w, n=4):
    return collections.Counter(' '.join(w[i:i + n]) for i in range(max(0, len(w) - n + 1)))

def score(a, b):
    ga, gb = grams(a), grams(b)
    if not ga or not gb: return 0
    inter = sum((ga & gb).values())
    return inter / max(1, min(sum(ga.values()), sum(gb.values())))

def key(k):
    c, rest = k.split('/'); f, i = rest.split('#')
    return (c, int(f.replace('.json', '')), int(i))

# наши тексты
texts = {}
for coll in ('bukhari', 'muslim', 'nawawi', 'riyad'):
    for f in glob.glob(H + '\\' + coll + '\\*.json'):
        d = json.load(io.open(f, encoding='utf-8'))
        fn = f.split('\\')[-1]
        for i, it in enumerate(d['items']):
            k = f'{coll}/{fn}#{i}'
            if k in m: texts[k] = norm(' '.join(it.get('ar') or []))

nass_cache = {}
def dbtext(hid):
    if hid not in nass_cache:
        r = con.execute('select nass from hadiths where id=?', (hid,)).fetchone()
        nass_cache[hid] = norm(r[0]) if r else []
    return nass_cache[hid]

out = io.open(SP + r'\hkg_scripts\align2.txt', 'w', encoding='utf-8')
final = {}      # наш ключ -> id хадиса в базе (Бухари/Муслим)
for coll in ('bukhari', 'muslim'):
    keys = sorted([k for k in m if k.startswith(coll + '/')], key=key)
    uniq = amb = scored = ordered = left = 0
    prev = min(v['ids'][0] for kk, v in m.items() if kk.startswith(coll + '/') and len(v['ids']) == 1) - 1
    for k in keys:
        ids = m[k]['ids']
        if len(ids) == 1:
            uniq += 1; final[k] = ids[0]
            if prev - 3 <= ids[0] <= prev + 400: prev = max(prev, ids[0])
            continue
        amb += 1
        sc = sorted(((score(texts[k], dbtext(h)), h) for h in ids), reverse=True)
        if sc[0][0] - sc[1][0] > 0.03:
            final[k] = sc[0][1]; scored += 1; prev = max(prev, sc[0][1]) if prev - 3 <= sc[0][1] <= prev + 400 else prev
            continue
        # равные по тексту — по порядку в книге, среди лучших по тексту
        best = [h for s, h in sc if sc[0][0] - s <= 0.03]
        near = [x for x in best if prev - 3 <= x <= prev + 120]
        if near:
            pick = min(near, key=lambda x: abs(x - prev - 1))
            final[k] = pick; ordered += 1; prev = max(prev, pick)
        else:
            left += 1
    out.write(f'{coll}: найдено {len(keys)}; однозначно {uniq}; неоднозначных {amb}: по тексту {scored}, по порядку {ordered}, не решено {left}\n')

# сахабий для Рияда и Навави
def sahabi_of(hid):
    r = con.execute('select s.id from sanads s where s.hadith_id=?', (hid,)).fetchall()
    res = []
    for (sid,) in r:
        last = con.execute('select rawi_id from sanad_rawis where sanad_id=? order by pos desc limit 1', (sid,)).fetchone()
        if last: res.append(last[0])
    return res
sahabi = {}
for coll in ('nawawi', 'riyad'):
    keys = [k for k in m if k.startswith(coll + '/')]
    ok = chk = good = 0
    for k in keys:
        votes = collections.Counter()
        for h in m[k]['ids'][:40]:
            for s in set(sahabi_of(h)): votes[s] += 1
        if not votes: continue
        rid, v = votes.most_common(1)[0]
        share = v / max(1, len(m[k]['ids'][:40]))
        nm = con.execute('select name, nickname, rank from rawis where id=?', (rid,)).fetchone()
        toks = norm(nm[0])[:2] if nm else []
        head = ' '.join(texts[k][:14])
        match = bool(toks) and all(t in head for t in toks)
        sahabi[k] = {'rawi': rid, 'share': round(share, 2), 'name_in_text': match}
        ok += 1; good += match
    out.write(f'{coll}: найдено {len(keys)}; сахабий определён у {ok}; имя сахабия есть в начале нашего текста у {good}\n')
out.close()
io.open(SP + r'\hkg_scripts\final2.json', 'w', encoding='utf-8').write(json.dumps({'chain': final, 'sahabi': sahabi}))
