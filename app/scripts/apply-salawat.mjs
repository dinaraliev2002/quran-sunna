// Благословение Пророку: везде в текстах приложения вместо «да благословит его Аллах и приветствует», «мир ему и благословение Аллаха»,
// «(с.а.в.с.)» и т. п. ставится один арабский значок ﷺ (так хочет автор приложения).
//   node scripts/apply-salawat.mjs          — применить к public/data и store-data (вызывается перед каждой сборкой: npm run build)
//   node scripts/apply-salawat.mjs --check  — только посчитать, ничего не менять
// Скрипт безопасно запускать сколько угодно раз: после замены искать уже нечего. Данные пересобираются из исходников скриптами
// build-*.py — после любой пересборки текстов этот скрипт повторяет замену (он подключён как prebuild в package.json).
//
// Что НЕ заменяется (это не благословение Пророку Мухаммаду): «мир им и благословение» (о других пророках), «мир ей и благословение»
// (о Фатиме), «да благословит их Аллах» (о нескольких людях), «мир ему» без «благословение» (о других пророках), а также смысловые
// выражения вроде «призывать благословение на Пророка».
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const check = process.argv.includes('--check')
const SIGN = 'ﷺ' // ﷺ

// сама формула (все встречающиеся написания, в том числе с опечатками: «миро ему», «ми благословение», «Аллаха» вместо «Аллах»)
const F = '(?:(?:да[ \\t]+)?благословит[ \\t]+его[ \\t]+Аллаха?[ \\t]+(?:и[ \\t]+)?(?:да[ \\t]+)?приветствует' +
  '|(?:да[ \\t]+)?благословит[ \\t]+его[ \\t]+Аллах[ \\t]+и[ \\t]+ниспошл[её]т[ \\t]+ему[ \\t]+мир' +
  '|мир[о]?[ \\t]+ему[ \\t]+(?:и|ми)[ \\t]+благословени[ея](?:[ \\t]+[Аа]ллаха)?)'
// «мир и благословение Аллаха» без «ему» — только сразу после слов «Пророк…», «Посланник…», «Мухаммад…» (иначе это просто выражение)
const BARE = '(?<=(?:Посланник[а-яё]*(?:[ \\t]+Аллаха)?|Пророк[а-яё]*|Мухаммад[а-яё]*))[ \\t]*(?:,[ \\t]*|\\([ \\t]*)мир[ \\t]+и[ \\t]+благословени[ея](?:[ \\t]+Аллаха)?[ \\t]*(?:,|\\))?'
const ABBR = '[ \\t]*\\([ \\t]*с\\.[ \\t]?а\\.[ \\t]?в\\.[ \\t]?с?\\.?[ \\t]*\\)'

const RULES = [
  [new RegExp(`[ \\t]*[,;]?[ \\t]*\\([ \\t]*${F}[ \\t]*\\)`, 'giu'), ' ' + SIGN], // (формула)
  [new RegExp(`[ \\t]*,[ \\t]*${F}[ \\t]*,`, 'giu'), ' ' + SIGN],               // , формула,
  [new RegExp(`[ \\t]*,[ \\t]*${F}`, 'giu'), ' ' + SIGN],                        // , формула (в конце)
  [new RegExp(`[ \\t]*${F}`, 'giu'), ' ' + SIGN],                                // формула без запятых
  [new RegExp(BARE, 'giu'), ' ' + SIGN],
  [new RegExp(ABBR, 'giu'), ' ' + SIGN],
  // после замены: двойные значки и лишние пробелы
  [new RegExp(`${SIGN}[ \\t]*\\([ \\t]*${SIGN}[ \\t]*\\)`, 'gu'), SIGN],
  [new RegExp(`${SIGN}[ \\t]*${SIGN}`, 'gu'), SIGN],
]
const QUICK = /благословит|благословени|с\.[ \t]?а\.[ \t]?в/i // быстрая проверка: есть ли в файле что менять

export function convert(text) {
  if (!QUICK.test(text)) return text
  let out = text
  for (const [rx, to] of RULES) out = out.replace(rx, to)
  return out
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) yield* walk(p)
    else if (name.endsWith('.json')) yield p
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const dirs = [join(root, 'public', 'data'), join(root, 'store-data')].filter(existsSync)
  const extra = [join(root, 'public', 'updates.json')].filter(existsSync)
  let files = 0, changed = 0, marks = 0
  for (const p of [...dirs.flatMap((d) => [...walk(d)]), ...extra]) {
    files++
    const src = readFileSync(p, 'utf8')
    const out = convert(src)
    if (out === src) continue
    changed++
    marks += (out.match(new RegExp(SIGN, 'g')) ?? []).length - (src.match(new RegExp(SIGN, 'g')) ?? []).length
    if (!check) writeFileSync(p, out, 'utf8')
  }
  console.log(`Благословение Пророку: проверено файлов ${files}, ${check ? 'изменилось бы' : 'изменено'} ${changed}, добавлено значков ﷺ: ${marks}`)
}
