// Для приложений в магазинах: после сборки сайта подменяет в dist данные «Истории аята» и комментарии Кулиева
// на версию из store-data (там только книги, на которые есть право). Telegram-версия не затрагивается.
//   npm run store-data   — пересобрать store-data из исходников (нужна папка asbab-src, только на компьютере автора)
//   node scripts/apply-store-data.mjs — применить к dist (то же делает Codemagic)
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
// fs.cpSync на Windows падает на путях с кириллицей — копируем по файлам
function copyDir(from, to) {
  mkdirSync(to, { recursive: true })
  for (const e of readdirSync(from, { withFileTypes: true })) {
    if (e.isDirectory()) copyDir(join(from, e.name), join(to, e.name))
    else copyFileSync(join(from, e.name), join(to, e.name))
  }
}
// разбор слов (Quranic Arabic Corpus) пока только для Telegram и сайта
rmSync(join(root, 'dist', 'data', 'morph'), { recursive: true, force: true })

for (const name of ['asbab', 'kuliev']) {
  const from = join(root, 'store-data', name)
  const to = join(root, 'dist', 'data', name)
  if (!existsSync(from)) { console.error(`Нет store-data/${name} — сначала npm run store-data`); process.exit(1) }
  rmSync(to, { recursive: true, force: true })
  copyDir(from, to)
  console.log(`dist/data/${name} ← store-data/${name}`)
}
