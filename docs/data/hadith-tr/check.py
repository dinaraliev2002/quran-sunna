import json, io, re, glob, sys
items = json.load(io.open('items.json', encoding='utf-8'))
done = {}
bad = []
for f in sorted(glob.glob('b*.json')):
    try:
        d = json.load(io.open(f, encoding='utf-8'))
    except Exception as e:
        print('ОШИБКА JSON', f, e); continue
    for k, v in d.items():
        done[int(k)] = v
        if re.search(r'[A-Za-z]', re.sub(r'\{\{\w+\|', '', v)): bad.append((f, k, v[:60]))
# какие id ожидались в готовых партиях
need = []
for f in sorted(glob.glob('b*.txt')):
    ids = [int(l.split('\t')[0]) for l in io.open(f, encoding='utf-8') if l.strip()]
    if glob.glob(f.replace('.txt', '.json')):
        need += [i for i in ids if i not in done]
print('переведено', len(done), 'из', len(items), '| пропущено в готовых партиях:', need[:20], '| латиница:', bad[:10])
