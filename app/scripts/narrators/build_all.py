import sqlite3, io, re, json, os, sys, collections
sys.path.insert(0, r'C:\Users\emila\AppData\Local\Temp\claude\C--Users-emila-Desktop--------------\5959476b-34e5-4457-99e3-f324264f98bf\scratchpad\hkg_scripts')
import formula
from critics_ru import CR
from critics_ru2 import CR2
from names_ru import ru_name
import glob as _g
TRD = r"C:\Users\emila\AppData\Local\Temp\claude\C--Users-emila-Desktop--------------\5959476b-34e5-4457-99e3-f324264f98bf\scratchpad\hkg_scripts\tr"
TR = {}
_ru = {}
for _f in _g.glob(TRD + r"\b*.json"):
    for _k, _v in json.load(io.open(_f, encoding='utf-8')).items(): _ru[int(_k)] = _v
for _it in json.load(io.open(TRD + r"\items.json", encoding='utf-8')):
    for _k in _it['keys']:
        if _it['id'] in _ru: TR[_k] = _ru[_it['id']]
SP = r'C:\Users\emila\AppData\Local\Temp\claude\C--Users-emila-Desktop--------------\5959476b-34e5-4457-99e3-f324264f98bf\scratchpad'
OUT = r'C:\Users\emila\Desktop\коран и сунна\app\public\data\narrators'
con = sqlite3.connect('file:' + SP + r'\hkg\hadith-kg.db?mode=ro', uri=True)
fin = json.load(io.open(SP + r'\hkg_scripts\final2.json', encoding='utf-8'))['chain']
sah = json.load(io.open(SP + r'\hkg_scripts\sahabi_tiers.json', encoding='utf-8'))
tqm = json.load(io.open(SP + r'\hkg_scripts\taq_match.json', encoding='utf-8'))
FIX = {'аз-Закарийа ас-Саджи': 'Закарийа ас-Саджи', 'Мухаммад ибн Уаддах': 'Мухаммад ибн Ваддах', 'аль-Баркий': 'аль-Барки', 'Вакы‘ ибн аль-Джаррах': 'Вакы‘ ибн аль-Джаррах'}

def sep(coll):
    pass

VER = json.load(io.open(os.path.join(SP, 'hkg_scripts', 'verify2.json'), encoding='utf-8'))
# ---- цепочки
chains = {'bukhari': {}, 'muslim': {}}
used = set()
for k, hid in fin.items():
    coll = k.split('/')[0]
    if coll not in chains: continue
    f, i = k.split('/')[1].split('#')
    if VER.get(f'{coll}/{f.replace(".json", "")}:{i}', ['нет'])[0] != 'точно': continue
    r = con.execute('select id from sanads where hadith_id=? order by id limit 1', (hid,)).fetchone()
    if not r: continue
    ch = [x[0] for x in con.execute('select rawi_id from sanad_rawis where sanad_id=? order by pos', (r[0],))]
    if not ch: continue
    chains[coll][f'{f.replace(".json", "")}:{i}'] = ch
    used.update(ch)
print({c: len(v) for c, v in chains.items()}, 'передатчиков в цепочках', len(used))

# ---- сахабии Рияда и Навави (только надёжно / по имени / по предыдущему)
sah_out = {'riyad': {}, 'nawawi': {}}
for k, v in sah.items():
    coll = k.split('/')[0]
    if v.get('tier') not in ('надёжно', 'по имени', 'по предыдущему хадису'): continue
    f, i = k.split('/')[1].split('#')
    sah_out[coll][f'{f.replace(".json", "")}:{i}'] = [v['rawi'], 1 if v['tier'] == 'надёжно' or v['tier'] == 'по предыдущему хадису' else 0]
    used.add(v['rawi'])
print({c: len(v) for c, v in sah_out.items()}, 'всего передатчиков', len(used))

# ---- ан-Навави и «Рияд»: полная цепочка того же хадиса из первоисточника (link_build.py + ручной подбор для ан-Навави)
links = json.load(io.open(SP + r'\hkg_scripts\links.json', encoding='utf-8'))
for no, v in json.load(io.open(SP + r'\hkg_scripts\nawawi_manual.json', encoding='utf-8')).items():
    links['nawawi'][f'1:{int(no) - 1}'] = v
if '1:8' in links['nawawi']: links['nawawi']['1:8'][1] = '1337'   # в переводе опечатка «1377»
for coll, d in links.items():
    for k, (code, n, ch) in d.items():
        used.update(ch)
        sah_out[coll][k] = [ch[-1], 1]   # сподвижник цепочки проверен по имени в тексте хадиса
print({c: len(v) for c, v in links.items()}, 'цепочек для ан-Навави и «Рияда»; передатчиков', len(used))

# ---- критики
prom = collections.Counter()
for rid in used:
    for (a,) in con.execute('select alem_id from aqwal where rawi_id=?', (rid,)): prom[a] += 1
alem = {}
for aid, name, nick, shuhra, dy in con.execute('select id,name,nickname,shuhra,death_year from alems'):
    alem[aid] = (shuhra or nick or ' '.join((name or '').split()[:3]), dy)

CRIT = ('слаб', 'неизвест', 'отвергаем', 'не сильн', 'не значит', 'порицан', 'лжец', 'лжёт', 'ложь', 'ложн', 'выдум', 'оставлен', 'ничего не стоит', 'не надёжн', 'пропащ', 'крад', 'не приводится', 'не приводят')
NOTE = ('ошиба', 'другой раз', 'ошибк', 'спор', 'разноглас', 'путан', 'спутал', 'изменил', 'скрыва', 'кадарит', 'мурджиит', 'шиизм', 'шиит', 'хариджит', 'есть вопрос')
def kind(ru):
    if not ru: return 'note'
    low = ru.lower()
    head = re.split(r'[.;:]', low, 1)[0]
    if any(x in head for x in CRIT) and not any(x in head for x in ('не вижу', 'ничего дурного', 'годн', 'правдив')): return 'crit'
    if any(x in low for x in CRIT) or any(x in low for x in NOTE): return 'note'
    return 'praise'

narr = {}
work = []   # для перевода позже
stat = collections.Counter()
for rid in sorted(used):
    r = con.execute('select name,nickname,rank,tabaka,death_year,has_tadlis,has_ikhtilat,is_stub from rawis where id=?', (rid,)).fetchone()
    if not r: continue
    name, nick, rank, dtab, dy, tz, ik, stub = r
    m = tqm.get(str(rid))
    # поколение из «Такриба» — если совпадает с базой или запись подтверждена годом смерти / ниспой
    use = m and m['tab'] and (m['tab'] == dtab or m.get('conf'))
    tab, tsrc = (m['tab'], 't') if use else (dtab, 'd')
    verdict = None
    quotes = []
    for aid, qawl in con.execute('select alem_id,qawl from aqwal where rawi_id=?', (rid,)):
        q = ' '.join((qawl or '').split())
        if not q: continue
        if aid == 1011 and 'قال في التقريب' in q and verdict is None:
            verdict = q.replace('قال في التقريب', '').strip(); continue
        ru = formula.translate(q)
        nm, yr = CR.get(aid, (None, None))
        nm = FIX.get(nm, nm) if nm else None
        if not nm and aid in CR2: nm = CR2[aid]; yr = alem.get(aid, ('', 0))[1] or None
        if not nm: nm = alem.get(aid, ('', 0))[0]; yr = alem.get(aid, ('', 0))[1] or None
        quotes.append((prom[aid], aid, nm, yr or 0, q[:400], ru))
    quotes.sort(key=lambda x: -x[0])
    tr = formula.translate(verdict) if verdict else None
    if verdict and not tr: tr = TR.get(f'{rid}:taq')
    # отбор: переведённые шаблонами (до 8), плюс до 3 свободных от самых известных критиков
    done = [x for x in quotes if x[5]][:8]
    free = [x for x in quotes if not x[5]]
    pick_free = free[:3] if len(done) < 5 else free[:2]
    sel = sorted(done + pick_free, key=lambda x: -x[0])
    c = []
    for _, aid, nm, yr, ar, ru in sel:
        if not ru: ru = TR.get(f'{rid}:{aid}')
        c.append([nm, yr, ar, ru, kind(ru), aid])
        if not ru: work.append({'k': f'{rid}:{aid}', 'who': nm, 'ar': ar})
    e = {'n': name, 'k': nick, 'rn': ru_name(nick or name), 'r': rank, 't': tab, 'ts': tsrc, 'd': dy, 'tq': verdict, 'tr': tr, 'c': c, 'nq': len(quotes)}
    if tz: e['tz'] = 1
    if ik: e['ik'] = 1
    if stub: e['st'] = 1
    narr[str(rid)] = e
    stat['передатчиков'] += 1
    if verdict and not tr: work.append({'k': f'{rid}:taq', 'who': 'Ибн Хаджар (Такриб)', 'ar': verdict})
    if verdict: stat['вердикт Такриба есть'] += 1
    if tr: stat['вердикт переведён шаблоном'] += 1

# ---- запись (шардами по 200 id)
os.makedirs(OUT, exist_ok=True)
for fn in os.listdir(OUT):
    if fn.startswith('n-') or fn in ('n.json',): os.remove(os.path.join(OUT, fn))
shards = collections.defaultdict(dict)
for k, v in narr.items(): shards[int(k) // 200][k] = v
for s, d in shards.items():
    io.open(os.path.join(OUT, f'n-{s}.json'), 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, separators=(',', ':')))
for coll, ch in chains.items():
    io.open(os.path.join(OUT, f'chains-{coll}.json'), 'w', encoding='utf-8').write(json.dumps(ch, ensure_ascii=False, separators=(',', ':')))
for coll, d in links.items():
    io.open(os.path.join(OUT, f'links-{coll}.json'), 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, separators=(',', ':')))
for coll, d in sah_out.items():
    io.open(os.path.join(OUT, f'sahabi-{coll}.json'), 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, separators=(',', ':')))
io.open(SP + r'\hkg_scripts\opus_worklist_left.json', 'w', encoding='utf-8').write(json.dumps(work, ensure_ascii=False))
tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT) if f.startswith(('n-', 'chains', 'sahabi')))
print(dict(stat), 'для перевода', len(work), 'слов арабского', sum(len(w['ar'].split()) for w in work), 'размер данных', tot // 1024, 'КБ', 'шардов', len(shards))
