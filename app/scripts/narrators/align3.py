import sqlite3, io, re, json, glob, collections
SP = r'C:\Users\emila\AppData\Local\Temp\claude\C--Users-emila-Desktop--------------\5959476b-34e5-4457-99e3-f324264f98bf\scratchpad'
H = r'C:\Users\emila\Desktop\коран и сунна\app\public\data\hadith'
fin = json.load(io.open(SP + r'\hkg_scripts\final2.json', encoding='utf-8'))
con = sqlite3.connect('file:' + SP + r'\hkg\hadith-kg.db?mode=ro', uri=True)

STOP = {'ابن', 'ابنه', 'عن', 'رضي', 'الله', 'عنه', 'عنهما', 'عنها', 'قال', 'ان', 'ابي', 'ام', 'ابو', 'عبد', 'له', 'رسول', 'مؤمنين', 'مومنين', 'رحمن'}
def toks(s):
    s = re.sub(r'[\u064B-\u0652\u0670\u0640\u06D6-\u06ED]', '', s or '')
    s = s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ٱ', 'ا').replace('ى', 'ي').replace('ة', 'ه')
    s = re.sub(r'[^\u0621-\u064A ]', ' ', s)
    s = re.sub(r'\bبن\b', 'ابن', s)
    out = []
    for t in s.split():
        t = re.sub(r'^ال', '', t)
        if t in ('ابي', 'ابا'): t = 'ابو'
        out.append(t)
    return out

# все сахабии из базы
sah = []
for rid, name, nick, rank, tab, rq in con.execute("select id,name,nickname,rank,tabaka,riwaya_qty from rawis where (rank like '%صحاب%' or rank like '%رؤية%' or tabaka=1) and is_stub=0"):
    sah.append((rid, [set(toks(name)) - STOP, set(toks(nick)) - STOP], rq or 0, nick or name, (toks(nick or name) or [''])[0]))
print('сахабиев в базе', len(sah))

def header(words):
    # слова после первого «عن» до «رضي»
    words = [re.sub(r'^و(?=عن$)', '', w) for w in words]
    try: i = words.index('عن')
    except ValueError: return None
    h = []
    for w in words[i + 1:i + 12]:
        if w in ('رضي', 'قال', 'ان', 'ﷺ'): break
        h.append(w)
    return h

m = json.load(io.open(SP + r'\hkg_scripts\match.json', encoding='utf-8'))
sah_by_id = {x[0]: x for x in sah}
def voted(k):
    out = collections.Counter()
    for h in m.get(k, {}).get('ids', [])[:40]:
        for (sid,) in con.execute('select id from sanads where hadith_id=?', (h,)).fetchall():
            r = con.execute('select rawi_id from sanad_rawis where sanad_id=? order by pos desc limit 1', (sid,)).fetchone()
            if r: out[r[0]] += 1
    return out
def f1(ht, ts, first=None, hfirst=None):
    sc = 0
    for t in ts:
        inter = len(ht & t)
        if inter == 0 or not t: continue
        p, r_ = inter / len(t), inter / len(ht)
        sc = max(sc, 2 * p * r_ / (p + r_))
    if sc and first and hfirst:
        if first == hfirst: sc += 0.25
    return sc
res = {}
stat = collections.Counter()
samples = []
for coll in ('nawawi', 'riyad'):
    files = sorted(glob.glob(H + '\\' + coll + '\\*.json'), key=lambda p: int(re.search(r'(\d+)\.json', p).group(1)))
    prev = None; prevk = None
    for f in files:
        d = json.load(io.open(f, encoding='utf-8')); fn = f.split('\\')[-1]
        for i, it in enumerate(d['items']):
            ar = ' '.join(it.get('ar') or [])
            if not ar.strip(): continue
            # убираем номер в начале
            body = re.sub(r'^[\s\d٠-٩\-–\.]+', '', ar)
            words = [w for w in re.sub(r'[\u064B-\u0652\u0670\u0640\u06D6-\u06ED]', '', body).split()][:16]
            w0 = re.sub(r'[^\u0621-\u064A]', '', words[0]) if words else ''
            k = f'{coll}/{fn}#{i}'
            if 'ﷺ' not in ar and 'رسول' not in ar and 'النبي' not in ar:
                stat[(coll, 'не хадис')] += 1; continue
            if w0 in ('وعنه', 'وعنها', 'وعنهما'):
                if prev: res[k] = dict(prev, how='وعنه', src=prevk); stat[(coll, 'وعنه')] += 1
                else: stat[(coll, 'не определён')] += 1
                continue
            h = header(toks(' '.join(words)))
            if not h: stat[(coll, 'не определён')] += 1; prev = None; continue
            ht = set(t for t in toks(' '.join(h)) if t not in STOP)
            if not ht: stat[(coll, 'не определён')] += 1; prev = None; continue
            hl = toks(' '.join(h)); hfirst = hl[0] if hl else None
            cand = voted(k)
            vb = [(f1(ht, sah_by_id[c][1], sah_by_id[c][4], hfirst), sah_by_id[c][2], c) for c in cand if c in sah_by_id]
            vb = [x for x in vb if x[0] >= 0.4]
            how = 'имя в тексте + совпадение текста'
            if vb:
                vb.sort(reverse=True)
                top = (vb[0][0], vb[0][1], vb[0][2], sah_by_id[vb[0][2]][3])
                conf = True
            else:
                best = []
                for rid, ts, rq, nick, fst in sah:
                    sc = f1(ht, ts, fst, hfirst)
                    if sc >= 0.7: best.append((round(sc, 3), rq, rid, nick))
                if not best: stat[(coll, 'не определён')] += 1; prev = None; continue
                best.sort(reverse=True)
                top = best[0]
                conf = False
                how = 'только имя в тексте'
            r = {'rawi': top[2], 'nick': top[3], 'hdr': ' '.join(h), 'how': how, 'confirmed_by_text': conf}
            res[k] = r; prev = r; prevk = k
            stat[(coll, 'определён')] += 1
            if conf: stat[(coll, 'подтверждён совпадением текста')] += 1
            if len(samples) < 14 and (len(samples) < 7 or not conf): samples.append((k, ' '.join(h), top[3], conf))
out = io.open(SP + r'\hkg_scripts\align3.txt', 'w', encoding='utf-8')
for k, v in sorted(stat.items()): out.write(f'{k}: {v}\n')
for s in samples: out.write(str(s) + '\n')
out.close()
io.open(SP + r'\hkg_scripts\sahabi_final.json', 'w', encoding='utf-8').write(json.dumps(res, ensure_ascii=False))
