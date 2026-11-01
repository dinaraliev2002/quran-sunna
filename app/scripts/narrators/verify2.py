import io, re, json, sqlite3, collections, os
SP = r'C:\Users\emila\AppData\Local\Temp\claude\C--Users-emila-Desktop--------------\5959476b-34e5-4457-99e3-f324264f98bf\scratchpad'
H = r'C:\Users\emila\Desktop\коран и сунна\app\public\data\hadith'
fin = json.load(io.open(SP + r'\hkg_scripts\final2.json', encoding='utf-8'))['chain']
con = sqlite3.connect('file:' + SP + r'\hkg\hadith-kg.db?mode=ro', uri=True)

def toks(s):
    s = re.sub(r'[\u064B-\u0652\u0670\u0640\u06D6-\u06ED]', '', s or '')
    s = s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ٱ', 'ا').replace('ى', 'ي').replace('ة', 'ه')
    s = re.sub(r'[^\u0621-\u064A ]', ' ', s)
    s = re.sub(r'\bبن\b', 'ابن', s)
    return [t for t in s.split() if t not in ('رضي', 'الله', 'عنه', 'عنها', 'عنهما', 'وا', 'ص')]

res = {}
stat = collections.Counter()
cache = {}
for k, hid in fin.items():
    coll = k.split('/')[0]
    if coll not in ('bukhari', 'muslim'): continue
    f, i = k.split('/')[1].split('#')
    bn = f.replace('.json', '')
    d = cache.get((coll, bn))
    if d is None:
        d = json.load(io.open(os.path.join(H, coll, f), encoding='utf-8')); cache[(coll, bn)] = d
    ours = toks(' '.join(d['items'][int(i)].get('ar') or []))[:14]
    r = con.execute('select nass from hadiths where id=?', (hid,)).fetchone()
    theirs = toks(r[0] if r else '')[:14]
    n = min(len(ours), len(theirs))
    same = sum(1 for a, b in zip(ours, theirs) if a == b)
    ratio = same / n if n else 0
    status = 'точно' if ratio >= 0.8 else 'похоже' if ratio >= 0.5 else 'нет'
    res[f'{coll}/{bn}:{i}'] = [status, round(ratio, 2)]
    stat[(coll, status)] += 1
io.open(SP + r'\hkg_scripts\verify2.json', 'w', encoding='utf-8').write(json.dumps(res))
o = io.open(SP + r'\hkg_scripts\verify2.txt', 'w', encoding='utf-8')
for k, v in sorted(stat.items()): o.write(f'{k}: {v}\n')
o.close()
