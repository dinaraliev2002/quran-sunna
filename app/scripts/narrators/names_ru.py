# Русское имя передатчика из арабского: по словарю частей имён (names_tok.json, переведён вручную)
import json, io, os, re
TOK = json.load(io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'names_tok.json'), encoding='utf-8'))
FIXED = {'بن': 'ибн', 'بنت': 'бинт', 'أبي': 'Аби', 'أبو': 'Абу', 'أم': 'Умм', 'ابن': 'Ибн'}
# известные имена в устоявшемся написании
WHOLE = {'أبو هريرة الدوسي': 'Абу Хурайра', 'عبد الله بن العباس القرشي': '‘Абдуллах ибн ‘Аббас', 'عبد الله بن عمر العدوي': '‘Абдуллах ибн ‘Умар',
         'عائشة بنت أبي بكر الصديق': '‘Аиша бинт Аби Бакр', 'محمد بن إسماعيل البخاري': 'Мухаммад ибн Исма‘иль аль-Бухари',
         'مسلم بن الحجاج القشيري': 'Муслим ибн аль-Хаджжадж', 'محمد بن عيسى الترمذي': 'Мухаммад ибн ‘Иса ат-Тирмизи'}

def units(nm):
    w = nm.split(); out = []; i = 0
    while i < len(w):
        if w[i] == 'عبد' and i + 1 < len(w) and w[i + 1].startswith('ال'):
            out.append(w[i] + ' ' + w[i + 1]); i += 2
        elif w[i] == 'عبيد' and i + 1 < len(w) and w[i + 1] == 'الله':
            out.append('عبيد الله'); i += 2
        else:
            out.append(w[i]); i += 1
    return out

ART = re.compile(r'^а(ль|[тсдзрнш]|ш)-(.+)$')
def ru_name(nm):
    if not nm: return ''
    if nm in WHOLE: return WHOLE[nm]
    parts = []
    for u in units(nm):
        if u == 'عبيد الله': parts.append('‘Убайдуллах'); continue
        r = FIXED.get(u) or TOK.get(u)
        if r is None: return ''          # неизвестная часть — лучше не показывать
        parts.append(r)
    out = []
    for p in parts:
        m = ART.match(p)
        if out and out[-1] in ('Абу', 'Аби') and m:   # Абу-ль-Касим, Абу-з-Зубайр
            out[-1] = out[-1] + '-' + ('ль' if m.group(1) == 'ль' else m.group(1)) + '-' + m.group(2); continue
        out.append(p)
    if 'вольноотпущенник' in out:            # «вольноотпущенник Ибн ‘Аббаса»: последнее слово — в родительном падеже
        w = out[-1]
        if out[-1] != 'вольноотпущенник':
            if w.endswith('я'): w = w[:-1] + 'и'
            elif w.endswith('а'): w = w[:-1] + ('и' if w[-2:-1] in 'кгхжшчщ' else 'ы')
            elif w.endswith('й'): w = w[:-1] + 'я'
            elif re.search(r'[бвгджзклмнпрстфхцчшщ‘’]$', w): w = w + 'а'
            out[-1] = w
    s = ' '.join(out)
    return s[0].upper() + s[1:] if s[0].islower() and not s.startswith(('аль-', 'ат-', 'ас-', 'ад-', 'аз-', 'ар-', 'ан-', 'аш-')) else s
