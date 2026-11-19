"""
Убирает одинаковые абзацы подряд в готовых данных хадисов (public/data/hadith/*/*.json) — без повторной сборки из сети.
То же делает paras() в build-hadith.py при пересборке. Можно запускать сколько угодно раз.
Запуск:  python -X utf8 scripts/dedupe-hadith.py
"""
import glob
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'hadith')
fixed = 0
for f in glob.glob(os.path.join(ROOT, '*', '*.json')):
    if os.path.basename(os.path.dirname(f)) in ('enc',):
        continue
    d = json.load(open(f, encoding='utf-8'))
    if not isinstance(d, dict) or 'items' not in d:
        continue
    changed = False
    for it in d['items']:
        for key in ('ru', 'ar'):
            ps = it.get(key)
            if not ps:
                continue
            out = []
            for p in ps:
                if out and out[-1] == p and len(p) > 20:
                    changed = True
                    fixed += 1
                    continue
                out.append(p)
            it[key] = out
    if changed:
        json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('убрано повторов:', fixed)
