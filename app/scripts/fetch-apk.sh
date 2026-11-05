#!/bin/bash
# Скачивает APK из запуска GitHub Actions с докачкой (сеть обрывает большие файлы):
#   bash scripts/fetch-apk.sh <id запуска> <папка>
# Результат: <папка>/app-debug.apk. Нужен gh (вход выполнен).
set -u
run="$1"; out="$2"; repo=dinaraliev2002/quran-sunna
mkdir -p "$out"
aid=$(gh api "repos/$repo/actions/runs/$run/artifacts" -q '.artifacts[0].id')
total=$(gh api "repos/$repo/actions/runs/$run/artifacts" -q '.artifacts[0].size_in_bytes')
t=$(gh auth token)
zip="$out/apk.zip"; rm -f "$zip"
newloc() { curl -s -m 40 -I -H "Authorization: Bearer $t" "https://api.github.com/repos/$repo/actions/artifacts/$aid/zip" | tr -d '' | grep -i '^location:' | sed 's/^[Ll]ocation: //'; }
for i in $(seq 1 300); do
  have=$(stat -c %s "$zip" 2>/dev/null || echo 0)
  [ "$have" -ge "$total" ] && break
  loc=$(newloc)   # ссылка живёт недолго — берём свежую на каждый кусок
  [ -z "$loc" ] && { sleep 5; continue; }
  # диапазон явно; пишем во временный файл и дописываем только при успешном ответе 206
  code=$(curl -s -L -m 150 -r "$have-$((total-1))" -o "$zip.part" -w '%{http_code}' "$loc")
  if [ "$code" = "206" ] || { [ "$code" = "200" ] && [ "$have" = 0 ]; }; then cat "$zip.part" >> "$zip"; fi
  rm -f "$zip.part"
  sleep 2
done
python -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print('test', z.testzip()); z.extractall(sys.argv[2])" "$zip" "$out"
rm -f "$zip"
ls -la "$out"
