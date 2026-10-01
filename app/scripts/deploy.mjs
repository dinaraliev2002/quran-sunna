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

const dir = mkdtempSync(join(tmpdir(), 'deploy-'))
try {
  run(`git clone -q --depth 1 --branch gh-pages --single-branch "${remote}" .`, dir)
  if (target === 'test') {
    rmSync(join(dir, 'test'), { recursive: true, force: true })
    copyDir(dist, join(dir, 'test'))
  } else {
    for (const f of readdirSync(dir)) if (f !== '.git' && f !== 'test') rmSync(join(dir, f), { recursive: true, force: true })
    copyDir(dist, dir)
  }
  writeFileSync(join(dir, '.nojekyll'), '')
  run('git add -A', dir)
  const changed = execSync('git status --porcelain', { cwd: dir }).toString().trim()
  if (!changed) console.log('Изменений нет')
  else {
    run(`git ${who} commit -q -m "${target === 'test' ? 'Тестовая версия' : 'Публикация приложения'}"`, dir)
    run('git push -q origin gh-pages', dir)
    console.log(target === 'test' ? 'Тестовая версия опубликована: https://dinaraliev2002.github.io/quran-sunna/test/' : 'Опубликовано для всех')
  }
} finally {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}
