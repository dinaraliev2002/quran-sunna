// Публикация на GitHub Pages: содержимое dist → ветка gh-pages.
// (Утилита gh-pages на Windows падает с ENAMETOOLONG, когда файлов много — поэтому свой скрипт.)
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

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
  for (const f of readdirSync(dir)) if (f !== '.git') rmSync(join(dir, f), { recursive: true, force: true })
  copyDir(dist, dir)
  writeFileSync(join(dir, '.nojekyll'), '')
  run('git add -A', dir)
  const changed = execSync('git status --porcelain', { cwd: dir }).toString().trim()
  if (!changed) console.log('Изменений нет')
  else {
    run(`git ${who} commit -q -m "Публикация приложения"`, dir)
    run('git push -q origin gh-pages', dir)
    console.log('Published')
  }
} finally {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}
