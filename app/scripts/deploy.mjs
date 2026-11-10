// Публикация на GitHub Pages: содержимое dist → ветка gh-pages.
//   node scripts/deploy.mjs test     — тестовая версия в папку /test/ (видна только по своей ссылке, для проверки)
//   node scripts/deploy.mjs release  — версия для всех (корень сайта); тестовая папка остаётся на месте
// (Утилита gh-pages на Windows падает с ENAMETOOLONG, когда файлов много — поэтому свой скрипт.)
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const target = process.argv[2]
if (target !== 'test' && target !== 'release') {
  console.error('Укажите, куда публиковать: test или release')
  process.exit(1)
}
const root = resolve(import.meta.dirname, '..')
const dist = join(root, 'dist')
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
const git = (k) => execSync(`git config ${k}`, { cwd: root }).toString().trim()
// автор коммита — как в основном репозитории
const who = `-c user.name="${git('user.name')}" -c user.email="${git('user.email')}"`
const remote = execSync('git remote get-url origin', { cwd: root }).toString().trim()

// fs.cpSync на Windows аварийно завершает Node на путях с кириллицей — копируем по файлам
function copyDir(from, to) {
  mkdirSync(to, { recursive: true })
  for (const e of readdirSync(from, { withFileTypes: true })) {
    if (e.isDirectory()) copyDir(join(from, e.name), join(to, e.name))
    else copyFileSync(join(from, e.name), join(to, e.name))
  }
}

// GitHub Pages иногда «роняет» сборку сайта (Page build failed) — тогда на сайте остаётся старая версия, хотя скрипт отчитался об успехе.
// Поэтому после отправки ждём результат сборки и при ошибке запускаем её заново (до 3 раз). Нужен установленный gh; без него просто пропускаем.
const sleep = (s) => execSync(process.platform === 'win32' ? `powershell -NoProfile -Command Start-Sleep ${s}` : `sleep ${s}`)
function pagesStatus() {
  try { return execSync('gh api repos/dinaraliev2002/quran-sunna/pages/builds/latest --jq .status', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return null }
}
function waitForPages() {
  if (pagesStatus() === null) { console.log('(gh недоступен — сборку Pages не проверяю)'); return }
  for (let attempt = 1; attempt <= 3; attempt++) {
    let st = 'queued'
    for (let i = 0; i < 72 && (st === 'queued' || st === 'building'); i++) { sleep(5); st = pagesStatus() ?? st } // полный сайт собирается до нескольких минут — пока идёт сборка, не перезапускаем
    if (st === 'built') { console.log('Сборка сайта на GitHub Pages прошла'); return }
    console.log(`Сборка Pages: ${st} — запускаю заново (${attempt}/3)`)
    if (st === 'errored') sleep(90) // сразу после сбоя новая сборка тоже падает — даём GitHub успокоиться
    try { execSync('gh api -X POST repos/dinaraliev2002/quran-sunna/pages/builds', { cwd: root, stdio: 'ignore' }) } catch {}
  }
  console.log('ВНИМАНИЕ: GitHub Pages не собрал сайт — на нём пока старая версия')
}

const dir = mkdtempSync(join(tmpdir(), 'deploy-'))
try {
  if (target === 'test') {
    // тестовая: скачиваем только список файлов, без содержимого (на медленном интернете полный сайт качается долго)
    // и заменяем в нём одну папку test/ — остальное в коммите остаётся как было
    run(`git clone -q --depth 1 --filter=blob:none --no-checkout --branch gh-pages --single-branch "${remote}" .`, dir)
    run('git read-tree HEAD', dir)
    run('git rm -r -q --cached --ignore-unmatch test', dir)
    copyDir(dist, join(dir, 'test'))
    run('git add test', dir)
  } else {
    run(`git clone -q --depth 1 --branch gh-pages --single-branch "${remote}" .`, dir)
    for (const f of readdirSync(dir)) if (f !== '.git' && f !== 'test') rmSync(join(dir, f), { recursive: true, force: true })
    copyDir(dist, dir)
  }
  writeFileSync(join(dir, '.nojekyll'), '')
  run(target === 'test' ? 'git add .nojekyll' : 'git add -A', dir)
  const changed = execSync('git diff --cached --name-only', { cwd: dir }).toString().trim()
  if (!changed) console.log('Изменений нет')
  else {
    run(`git ${who} commit -q -m "${target === 'test' ? 'Тестовая версия' : 'Публикация приложения'}"`, dir)
    run('git push -q origin gh-pages', dir)
    waitForPages()
    console.log(target === 'test' ? 'Тестовая версия опубликована: https://dinaraliev2002.github.io/quran-sunna/test/' : 'Опубликовано для всех')
  }
} finally {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}
