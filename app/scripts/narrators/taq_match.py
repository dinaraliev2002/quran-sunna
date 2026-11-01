import sqlite3, io, re, json, collections
SP = r'C:\Users\emila\AppData\Local\Temp\claude\C--Users-emila-Desktop--------------\5959476b-34e5-4457-99e3-f324264f98bf\scratchpad'
con = sqlite3.connect('file:' + SP + r'\hkg\hadith-kg.db?mode=ro', uri=True)
fin = json.load(io.open(SP + r'\hkg_scripts\final2.json', encoding='utf-8'))
sah = json.load(io.open(SP + r'\hkg_scripts\sahabi_tiers.json', encoding='utf-8'))

def norm(s):
    s = re.sub(r'[\u064B-\u0652\u0670\u0640]', '', s or '')
    s = s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ى', 'ي').replace('ة', 'ه').replace('ٱ', 'ا')
    s = re.sub(r'[^\u0621-\u064A ]', ' ', s)
    s = re.sub(r'\bبن\b', 'ابن', s)
    return [re.sub(r'^ال', '', t) for t in s.split()]

# --- Такриб
txt = io.open(SP + r'\hkg\taqrib.txt', encoding='utf-8').read()
parts = re.split(r'### \| [^\n]*\n', txt)[1:]
E = []
for p in parts:
    p = re.sub(r'# PageV\d+P\d+', '', p)
    p = re.sub(r'\n~~', ' ', p).replace('\n', ' ').strip().lstrip('# ').strip()
    p = re.sub(r'\s*#\s*\[\].*$', '', p)       # отсылки «#[] ... »
    E.append(p)

ORD = [('الحادية عشرة', 11), ('الثانية عشرة', 12), ('الحاديه عشره', 11), ('الثانيه عشره', 12), ('الأولى', 1), ('الثانية', 2), ('الثالثة', 3), ('الرابعة', 4), ('الخامسة', 5),
       ('السادسة', 6), ('السابعة', 7), ('الثامنة', 8), ('التاسعة', 9), ('العاشرة', 10), ('العاشره', 10), ('الثانيه', 2), ('الثالثه', 3), ('الرابعه', 4), ('الخامسه', 5), ('السادسه', 6), ('السابعه', 7), ('الثامنه', 8), ('التاسعه', 9)]
def tab_of(e):
    for pat in ('من', 'الطبقة'):
      for m in re.finditer(pat + r' (?:كبار |أوساط |صغار |رؤوس |أواسط |أصاغر )?(?:الطبقة )?(الحادية عشرة|الثانية عشرة|الحاديه عشره|الثانيه عشره|[ء-ي]+)', e):
        w = m.group(1)
        for k, v in ORD:
            if w == k: return v
    return None

UNITS = {'واحد': 1, 'احدي': 1, 'اثنتين': 2, 'اثنين': 2, 'ثنتين': 2, 'ثلاث': 3, 'اربع': 4, 'خمس': 5, 'ست': 6, 'سبع': 7, 'ثمان': 8, 'تسع': 9, 'عشر': 10}
TENS = {'عشرين': 20, 'ثلاثين': 30, 'اربعين': 40, 'خمسين': 50, 'ستين': 60, 'سبعين': 70, 'ثمانين': 80, 'تسعين': 90}
def year_of(e):
    md = re.search(r'مات (?:في [^ ]+ )?(?:سنة|بعد سنة) (\d{2,3})', e)
    if md: return (int(md.group(1)), True)
    m = re.search(r'مات (?:في [^ ]+ )?(?:سنة|بعد سنة) ([^\n]{0,60})', e)
    if not m: return None
    ws = [re.sub(r'^و', '', re.sub(r'[\u064B-\u0652\u0670\u0640]', '', w).replace('أ', 'ا').replace('إ', 'ا').replace('ى', 'ي').replace('ة', 'ه')) for w in m.group(1).split()]
    v = 0; got = False; hundreds = 0
    for w in ws[:5]:
        w2 = w.rstrip('ه')
        if w in TENS: v += TENS[w]; got = True
        elif w2 in UNITS or w in UNITS: v += UNITS.get(w2, UNITS.get(w)); got = True
        elif w in ('مايه', 'مائه', 'ماءه', 'مائتين', 'ومائتين', 'مايتين'):
            hundreds = 200 if 'تين' in w else 100
        else: break
    return (v + hundreds, hundreds > 0) if got else None

tq = []
for e in E:
    toks = norm(e)[:14]
    tq.append({'t': toks, 'tab': tab_of(e), 'yr': year_of(e), 'txt': e})
byfirst = collections.defaultdict(list)
for i, x in enumerate(tq):
    if x['t']: byfirst[x['t'][0]].append(i)

# --- передатчики из цепочек
ids = set()
for k, hid in fin['chain'].items():
    r = con.execute('select id from sanads where hadith_id=? order by id limit 1', (hid,)).fetchone()
    if r: ids.update(x[0] for x in con.execute('select rawi_id from sanad_rawis where sanad_id=?', (r[0],)))
ids.update(v['rawi'] for v in sah.values() if v.get('tier') in ('надёжно', 'по имени', 'по предыдущему хадису'))
ids.discard(None)
print('передатчиков', len(ids))

res = {}
stat = collections.Counter()
for rid in sorted(ids):
    r = con.execute('select name,nickname,tabaka,death_year,rank from rawis where id=?', (rid,)).fetchone()
    if not r: continue
    name, nick, dtab, dy, rank = r
    nt = norm(name)
    if not nt: continue
    best = None; bl = 0; amb = 0
    for i in byfirst.get(nt[0], []):
        tt = tq[i]['t']
        L = 0
        while L < len(nt) and L < len(tt) and nt[L] == tt[L]: L += 1
        if L < min(len(nt), 4): continue
        # год: сверяем по последним двум цифрам, если есть
        ok = True
        y = tq[i]['yr']
        if y and dy:
            if y[1]: ok = (y[0] == dy)
            else: ok = (y[0] % 100 == dy % 100)
        score = L + (2 if (y and dy and ok) else 0) - (3 if not ok else 0)
        if score > bl: best, bl, amb = i, score, 0
        elif score == bl and best is not None: amb += 1
    if best is not None and amb == 0 and bl >= 2:
        x = tq[best]
        y = x['yr']
        yok = bool(y and dy and ((y[0] == dy) if y[1] else (y[0] % 100 == dy % 100)))
        nis = [t for t in norm(nick)[2:] if len(t) > 3] if nick else []
        nok = bool(nis) and nis[-1] in x['t']
        res[str(rid)] = {'tab': x['tab'], 'dbtab': dtab, 'txt': x['txt'][:500], 'hasyr': bool(y), 'conf': yok or nok}
        stat['сопоставлен'] += 1
        if x['tab'] and dtab and x['tab'] != dtab:
            stat['поколение отличается от базы'] += 1
            if yok or nok: stat['  из них подтверждено годом или ниспой'] += 1
        if x['tab'] is None: stat['в Такрибе нет поколения (сподвижник)'] += 1
    else:
        stat['не сопоставлен'] += 1
io.open(SP + r'\hkg_scripts\taq_match.json', 'w', encoding='utf-8').write(json.dumps(res, ensure_ascii=False))
print(dict(stat))
