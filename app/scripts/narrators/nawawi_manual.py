# Ручной подбор цепочек для хадисов ан-Навави, которые не прошли автоматическую проверку.
# Для каждого: книга по ссылке ан-Навави, характерная фраза текста, ожидаемый сподвижник.
import sqlite3, json, io, re
SP = r'C:\Users\emila\AppData\Local\Temp\claude\C--Users-emila-Desktop--------------\5959476b-34e5-4457-99e3-f324264f98bf\scratchpad'
con = sqlite3.connect('file:' + SP + r'\hkg\hadith-kg.db?mode=ro', uri=True)
o = io.open(SP + r'\hkg_scripts\nawawi_manual.txt', 'w', encoding='utf-8')

def norm(s):
    s = re.sub(r'[\u064B-\u0652\u0670\u0640\u06D6-\u06ED]', '', s or '')
    s = s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ى', 'ي').replace('ة', 'ه')
    return ' '.join(re.sub(r'[^\u0621-\u064A ]', ' ', s).split())

def rid(nick_part):
    rows = con.execute("select id, nickname, riwaya_qty from rawis where nickname like ? order by riwaya_qty desc", ('%' + nick_part + '%',)).fetchall()
    return rows

# сподвижники, которые понадобятся
for q in ('تميم بن أوس', 'عبد الله بن مسعود', 'أبو هريرة', 'أبو ذر', 'سفيان بن عبد الله', 'النواس', 'العرباض', 'معاذ بن جبل',
          'أبو ثعلبة', 'جرثوم', 'أبو سعيد الخدري', 'عبد الله بن العباس', 'عبد الله بن عمرو', 'الحسن بن علي', 'جابر بن عبد الله'):
    o.write(q + ' → ' + str(rid(q)[:3]) + '\n')

# (№ у ан-Навави, книга, номер для подписи, фраза, подстрока имени сподвижника)
TASK = [
    (7, 2, '55', 'الدين النصيحه', 'تميم'),
    (11, 3, '2518', 'دع ما يريبك الي ما لا يريبك', 'الحسن بن علي'),
    (12, 3, '2317', 'من حسن اسلام المرء تركه ما لا يعنيه', 'هريرة'),
    (14, 1, '6878', 'لا يحل دم امرئ مسلم', 'مسعود'),
    (15, 1, '6018', 'من كان يؤمن بالله واليوم الاخر فليقل خيرا او ليصمت', 'هريرة'),
    (18, 3, '1987', 'اتق الله حيثما كنت', 'ذر'),
    (21, 2, '38', 'امنت بالله', 'سفيان بن عبد الله'),
    (22, 2, '15', 'صليت الصلوات المكتوبات', 'جابر'),
    (26, 2, '1009', 'تعدل بين الاثنين صدقه', 'هريرة'),
    (27, 2, '2553', 'البر حسن الخلق', 'سمعان'),
    (28, 4, '4607', 'عليكم بسنتي وسنه الخلفاء', 'العرباض'),
    (29, 3, '2616', 'اخبرني بعمل يدخلني الجنه', 'معاذ'),
]
res = {}
for no, book, label, ph, sah in TASK:
    found = None
    for hid, nass in con.execute('select id, nass from hadiths where book_id=? order by id', (book,)):
        if ph not in norm(nass): continue
        r = con.execute('select id from sanads where hadith_id=? order by id limit 1', (hid,)).fetchone()
        if not r: continue
        ch = [x[0] for x in con.execute('select rawi_id from sanad_rawis where sanad_id=? order by pos', (r[0],))]
        if len(ch) < 3: continue
        nick = con.execute('select nickname from rawis where id=?', (ch[-1],)).fetchone()[0] or ''
        if sah not in nick: continue
        found = (hid, ch, nick); break
    if not found:
        o.write(f'{no}: НЕ НАЙДЕНО\n'); continue
    hid, ch, nick = found
    nass, ms, me = con.execute('select nass, matn_start, matn_end from hadiths where id=?', (hid,)).fetchone()
    code = {1: 'bukhari', 2: 'muslim', 3: 'tirmidhi', 4: 'abudawud'}[book]
    res[no] = [code, label, ch]
    o.write(f'{no}: {code} {label} hid={hid} звеньев={len(ch)} сподвижник={nick}\n   {(nass[ms:me] if ms is not None and me else nass)[:200]}\n')
io.open(SP + r'\hkg_scripts\nawawi_manual.json', 'w', encoding='utf-8').write(json.dumps(res, ensure_ascii=False))
