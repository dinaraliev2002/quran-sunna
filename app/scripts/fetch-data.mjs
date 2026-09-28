// Скачивает весь текст Корана из Quran.com API v4 и раскладывает в public/data.
// Запуск: npm run data   (один раз; результат хранится в проекте, приложение не ходит в чужие API)
//
// public/data/surahs.json        — список сур
// public/data/quran/NNN.json     — аяты суры: текст, таджвид, переводы Кулиева и Абу Аделя, слова, глифы QPC
// public/data/tafsir/NNN.json    — тафсир ас-Саади (только аяты, на которых стоит текст группы)
// public/data/mushaf/NNN.json    — раскладка страницы мусхафа: строка → глифы QPC V2

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://api.quran.com/api/v4'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
const TR_KULIEV = 45
const TR_ABU_ADEL = 79
const TAFSIR_SAADI = 170

// Русские названия сур (транслитерация)
const RU_NAMES = `Аль-Фатиха|Аль-Бакара|Али Имран|Ан-Ниса|Аль-Маида|Аль-Анам|Аль-Араф|Аль-Анфаль|Ат-Тауба|Юнус|Худ|Юсуф|Ар-Раад|Ибрахим|Аль-Хиджр|Ан-Нахль|Аль-Исра|Аль-Кахф|Марьям|Та Ха|Аль-Анбия|Аль-Хадж|Аль-Муминун|Ан-Нур|Аль-Фуркан|Аш-Шуара|Ан-Намль|Аль-Касас|Аль-Анкабут|Ар-Рум|Лукман|Ас-Саджда|Аль-Ахзаб|Саба|Фатыр|Йа Син|Ас-Саффат|Сад|Аз-Зумар|Гафир|Фуссылят|Аш-Шура|Аз-Зухруф|Ад-Духан|Аль-Джасия|Аль-Ахкаф|Мухаммад|Аль-Фатх|Аль-Худжурат|Каф|Аз-Зарият|Ат-Тур|Ан-Наджм|Аль-Камар|Ар-Рахман|Аль-Вакиа|Аль-Хадид|Аль-Муджадала|Аль-Хашр|Аль-Мумтахана|Ас-Сафф|Аль-Джумуа|Аль-Мунафикун|Ат-Тагабун|Ат-Талак|Ат-Тахрим|Аль-Мульк|Аль-Калам|Аль-Хакка|Аль-Мааридж|Нух|Аль-Джинн|Аль-Муззаммиль|Аль-Муддассир|Аль-Кияма|Аль-Инсан|Аль-Мурсалят|Ан-Наба|Ан-Назиат|Абаса|Ат-Таквир|Аль-Инфитар|Аль-Мутаффифин|Аль-Иншикак|Аль-Бурудж|Ат-Тарик|Аль-Аля|Аль-Гашия|Аль-Фаджр|Аль-Балад|Аш-Шамс|Аль-Лайль|Ад-Духа|Аш-Шарх|Ат-Тин|Аль-Аляк|Аль-Кадр|Аль-Баййина|Аз-Зальзаля|Аль-Адият|Аль-Кариа|Ат-Такасур|Аль-Аср|Аль-Хумаза|Аль-Филь|Курайш|Аль-Маун|Аль-Каусар|Аль-Кафирун|Ан-Наср|Аль-Масад|Аль-Ихлас|Аль-Фаляк|Ан-Нас`.split('|')

const pad = (n) => String(n).padStart(3, '0')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stripHtml = (s) => s.replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '').trim()

async function get(path, tries = 5) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(API + path, { headers: { 'User-Agent': 'quran-sunna-miniapp/0.1 (data build)' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      if (i >= tries) throw new Error(`${path}: ${e.message}`)
      await sleep(1000 * i)
    }
  }
}

// Все страницы постраничного ответа
async function getAll(path, key) {
  const items = []
  for (let page = 1; ; page++) {
    const sep = path.includes('?') ? '&' : '?'
    const d = await get(`${path}${sep}per_page=50&page=${page}`)
    items.push(...d[key])
    if (!d.pagination?.next_page) return items
  }
}

async function save(rel, data) {
  const file = join(OUT, rel)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(data))
}

// Ограничение параллельных запросов, чтобы не нагружать API
async function pool(items, limit, fn) {
  let i = 0
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) await fn(items[i++])
  }))
}

async function main() {
  const { chapters } = await get('/chapters?language=ru')
  if (chapters.length !== 114) throw new Error('ожидалось 114 сур')

  const surahs = chapters.map((c) => ({
    id: c.id,
    name: RU_NAMES[c.id - 1],
    meaning: c.translated_name.name,
    ar: c.name_arabic,
    ayahs: c.verses_count,
    mk: c.revelation_place === 'makkah',
    rev: c.revelation_order,
    pages: c.pages,
    bism: c.bismillah_pre,
  }))
  await save('surahs.json', surahs)

  const pages = new Map() // номер страницы → { lines: {n: [[глиф, 'с:а', конец]]}, starts: [[сура, строка]] }
  let totalAyahs = 0
  let done = 0

  await pool(surahs, 4, async (s) => {
    const verses = await getAll(
      `/verses/by_chapter/${s.id}?translations=${TR_KULIEV},${TR_ABU_ADEL}&fields=text_uthmani,text_uthmani_tajweed` +
        `&words=true&word_fields=code_v2,line_number,text_uthmani`,
      'verses',
    )
    if (verses.length !== s.ayahs) throw new Error(`сура ${s.id}: ${verses.length} из ${s.ayahs} аятов`)

    const ayahs = verses.map((v) => {
      const tr = Object.fromEntries(v.translations.map((t) => [t.resource_id, stripHtml(t.text)]))
      const words = v.words.filter((w) => w.char_type_name === 'word')
      for (const w of v.words) {
        const p = w.page_number
        if (!pages.has(p)) pages.set(p, { lines: {}, starts: [] })
        const pg = pages.get(p)
        ;(pg.lines[w.line_number] ??= []).push([w.code_v2, v.verse_key, w.char_type_name === 'end' ? 1 : 0, w.position])
      }
      if (v.verse_number === 1) pages.get(v.words[0].page_number).starts.push([s.id, v.words[0].line_number])
      return {
        n: v.verse_number,
        p: v.page_number,
        j: v.juz_number,
        t: v.text_uthmani,
        tj: v.text_uthmani_tajweed.replace(/<span class=end>.*?<\/span>/g, '').trim(),
        ku: tr[TR_KULIEV] ?? '',
        aa: tr[TR_ABU_ADEL] ?? '',
        w: words.map((w) => w.text_uthmani),
        // глифы слов для шрифтов страниц QPC (V2 — обычный, V4 — таджвид), включая знак конца аята
        g: v.words.map((w) => w.code_v2).join(' '),
      }
    })
    await save(`quran/${pad(s.id)}.json`, { id: s.id, ayahs })

    const tafsir = await getAll(`/tafsirs/${TAFSIR_SAADI}/by_chapter/${s.id}`, 'tafsirs')
    const tf = {}
    for (const t of tafsir) {
      const text = stripHtml(t.text)
      if (text) tf[t.verse_key.split(':')[1]] = text
    }
    await save(`tafsir/${pad(s.id)}.json`, tf)

    totalAyahs += ayahs.length
    process.stdout.write(`\rсуры: ${++done}/114`)
  })
  console.log()

  // Страницы мусхафа: слова в строке — по порядку аятов и позиций
  const order = (key) => key.split(':').map(Number)
  for (const [p, pg] of pages) {
    for (const ln of Object.values(pg.lines)) {
      ln.sort((a, b) => {
        const [sa, aa] = order(a[1]), [sb, ab] = order(b[1])
        return sa - sb || aa - ab || a[3] - b[3]
      })
      ln.forEach((w) => w.pop()) // позиция больше не нужна
    }
    await save(`mushaf/${pad(p)}.json`, { p, ...pg })
  }

  // Проверки полноты
  const problems = []
  if (totalAyahs !== 6236) problems.push(`аятов ${totalAyahs}, ожидалось 6236`)
  if (pages.size !== 604) problems.push(`страниц ${pages.size}, ожидалось 604`)
  for (const [p, pg] of pages) {
    const used = Object.keys(pg.lines).length + pg.starts.length * 2
    // страницы 1–2 оформлены иначе (меньше строк); у остальных строки со словами + заголовки = 15
    if (p > 2 && used !== 15 && !(used === 16 && pg.starts.some(([, l]) => l === 1))) problems.push(`стр. ${p}: ${used} строк`)
  }
  console.log(`Аятов: ${totalAyahs}, страниц: ${pages.size}`)
  console.log(problems.length ? `Замечания:\n  ${problems.join('\n  ')}` : 'Проверка пройдена ✓')
}

main().catch((e) => {
  console.error('\nОшибка:', e.message)
  process.exit(1)
})
