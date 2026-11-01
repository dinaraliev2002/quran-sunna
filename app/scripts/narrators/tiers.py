# Уровень уверенности в сахабии для Рияда и Навави. «وعنه» получает уровень того хадиса, на который ссылается.
import json, io, re, sqlite3, collections, os
SP = r'C:\Users\emila\AppData\Local\Temp\claude\C--Users-emila-Desktop--------------\5959476b-34e5-4457-99e3-f324264f98bf\scratchpad'
r = json.load(io.open(os.path.join(SP, 'hkg_scripts', 'sahabi_final.json'), encoding='utf-8'))
con = sqlite3.connect('file:' + SP + r'\hkg\hadith-kg.db?mode=ro', uri=True)

def toks(s):
    s = re.sub(r'[\u064B-\u0652\u0670\u0640\u06D6-\u06ED]', '', s or '')
    s = s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ى', 'ي').replace('ة', 'ه')
    s = re.sub(r'[^\u0621-\u064A ]', ' ', s)
    return [re.sub(r'^ال', '', t) for t in s.split()]
STOP = {'ابن', 'عن', 'رضي', 'الله', 'عنه', 'قال', 'ابي', 'ام', 'ابو', 'عبد', 'له', 'رسول'}

out = {}
tier = collections.Counter()
for k, v in r.items():
    if v['how'] == 'وعنه': continue
    c = k.split('/')[0]
    if v['confirmed_by_text']: t = 'надёжно'
    else:
        ht = [x for x in toks(v['hdr']) if x not in STOP]
        t = 'проверить вручную'
        if len(set(ht)) >= 2:
            nm = set(toks(v['nick'])) - STOP
            inter = len(set(ht) & nm)
            if inter >= 2 and inter / max(1, len(nm)) >= 0.6:
                q = con.execute('select riwaya_qty from rawis where id=?', (v['rawi'],)).fetchone()
                # «вторичные» записи базы (номера от 29000) и почти без хадисов — не принимаем по одному имени
                if v['rawi'] < 29000 and q and (q[0] or 0) >= 5: t = 'по имени'
        elif len(set(ht)) == 1:
            w = ht[0]
            row = con.execute("select id,nickname from rawis where rank like '%صحاب%' and (nickname like ? or name like ?) order by riwaya_qty desc limit 1", (w + '%', '%' + w + '%')).fetchone()
            if row:
                v = dict(v, rawi=row[0], nick=row[1]); t = 'вероятно'
    out[k] = dict(v, tier=t)
    tier[(c, t)] += 1
for k, v in r.items():
    if v['how'] != 'وعنه': continue
    src = out.get(v.get('src'))
    if not src: continue
    out[k] = dict(src, how='وعنه', src=v['src'])
    tier[(k.split('/')[0], 'вслед за предыдущим: ' + src['tier'])] += 1
io.open(os.path.join(SP, 'hkg_scripts', 'sahabi_tiers.json'), 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False))
io.open(os.path.join(SP, 'hkg_scripts', 'tiers.txt'), 'w', encoding='utf-8').write('\n'.join(f'{a}: {b}' for a, b in sorted(tier.items())))
