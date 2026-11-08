// Цельные записи сур и разметка по ним → public/data/recite/
//   node scripts/fetch-recitations.mjs            — все чтецы
//   node scripts/fetch-recitations.mjs qatami     — только указанные
// Плеер играет одну запись на всю суру (без пауз на стыках аятов), а по разметке знает, где какой аят и слово.
//   recite/index.json     — { чтец: { u: [адрес записи суры ×114], b: [байт ×114], w: есть ли разметка слов } }
//   recite/<чтец>/NNN.json — { a: [[начало_мс, конец_мс] по аятам], w?: [[[слово, начало, конец], …] по аятам] }
// Время — от начала файла суры. Ошибки готовой разметки и суры без неё — scripts/align-recitation.py
// (по файлам аятов той же записи на everyayah).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const OUT = join(root, 'public', 'data', 'recite')
const pad = (n) => String(n).padStart(3, '0')

// qdc — Quran.com (разметка аятов и слов), mp3q — mp3quran.net (разметка аятов)
const SOURCES = {
  alafasy: { qdc: 7 }, // та же запись, что на everyayah; ошибки границ в разметке исправляет align-recitation.py
  husary: { qdc: 6 },
  husary_m: { qdc: 12 },
  sudais: { qdc: 3 },
  shuraym: { qdc: 10 },
  shatri: { qdc: 4 },
  dosari: { qdc: 97 },
  qatami: { mp3q: 86, folder: 'https://cdn.mp3quran.net/audio/nasser-qatami/r1/' },
  // без готовой разметки: только адреса. Джухани (quranicaudio) и Аймен Сувейд — те же записи, что на everyayah
  // (Abdullaah_3awwaad_Al-Juhaynee_128kbps, Ayman_Sowaid_64kbps): разметка — align-recitation.py.
  // аль-Муайкли — цельной записи, совпадающей с everyayah, нет, а по паузам (эхо) границы не найти:
  // без разметки сура звучит целиком с начала, а с середины и в заучивании — файлами аятов (плеер)
  juhani: { folder: 'https://download.quranicaudio.com/quran/abdullaah_3awwaad_al-juhaynee/' },
  ayman: { folder: 'https://server15.mp3quran.net/a-rushdi/Almusshaf-Al-Mo-lim/' },
  muaiqly: { folder: 'https://cdn.mp3quran.net/audio/maher-muaiqly/r1/' },
  // аль-Люхайдан: ни разметки, ни файлов аятов нигде нет — только сура целиком
  luhaidan: { folder: 'https://cdn.mp3quran.net/audio/muhammad-luhaidan/r1/' },
}

const counts = JSON.parse(readFileSync(join(root, 'public', 'data', 'surahs.json'), 'utf8')).map((s) => s.ayahs)

async function get(url, as = 'json') {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (quran-sunna build script)' } })
      if (!r.ok) throw new Error(`${url}: ${r.status}`)
      return as === 'json' ? await r.json() : r
    } catch (e) {
      if (i === 4) throw e
      await new Promise((ok) => setTimeout(ok, 1500 * (i + 1)))
    }
  }
}

async function size(url) {
  const r = await fetch(url, { method: 'HEAD' })
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  return Number(r.headers.get('content-length'))
}

/** Quran.com: адрес записи и разметка аятов и слов */
async function qdc(id, s) {
  const d = await get(`https://api.qurancdn.com/api/qdc/audio/reciters/${id}/audio_files?chapter=${s}&segments=true`)
  const f = d.audio_files[0]
  const vt = f.verse_timings
  if (vt.length !== counts[s - 1]) throw new Error(`qdc ${id} сура ${s}: ${vt.length} аятов вместо ${counts[s - 1]}`)
  const a = [], w = []
  vt.forEach((v, i) => {
    if (v.verse_key !== `${s}:${i + 1}`) throw new Error(`qdc ${id}: порядок аятов ${v.verse_key}`)
    a.push([v.timestamp_from, v.timestamp_to])
    // сегменты: [слово, начало, конец]; бывают пустые и обрывки — оставляем только целые
    const ws = (v.segments ?? []).filter((g) => g.length === 3 && g[2] > g[1]).map((g) => [g[0], g[1], g[2]])
    // слова, вышедшие за свой аят, — ошибка разметки: такой аят подсвечиваем только целиком
    const ok = ws.every((g, j) => g[1] >= v.timestamp_from - 500 && g[2] <= v.timestamp_to + 500 && (!j || g[1] >= ws[j - 1][1]))
    w.push(ok ? ws : [])
  })
  return { url: f.audio_url, a, w }
}

/** mp3quran.net: разметка аятов (аят 0 — басмала перед сурой) */
async function mp3q(src, s) {
  const d = await get(`https://mp3quran.net/api/v3/ayat_timing?surah=${s}&read=${src.mp3q}`)
  const list = d.filter((x) => x.ayah > 0)
  const url = src.folder + pad(s) + '.mp3'
  // разметка неполная — суру размечает align-recitation.py
  if (list.length !== counts[s - 1] || list.some((x, i) => x.ayah !== i + 1)) return { url, missing: `${s}: ${list.length} из ${counts[s - 1]}` }
  return { url, a: list.map((x) => [x.start_time, x.end_time]) }
}

/** Проверка: аяты идут по порядку и не налезают друг на друга; слова — внутри своего аята. Возвращает список сбоев */
function check(key, s, a, w) {
  const bad = []
  for (let i = 0; i < a.length; i++) {
    const [f, t] = a[i]
    if (!(t > f)) bad.push(`${s}:${i + 1} пустой ${f}–${t}`)
    if (i && f < a[i - 1][1] - 300) bad.push(`${s}:${i + 1} налезает на ${s}:${i} (${a[i - 1][1] - f} мс)`)
    if (i && f > a[i - 1][1] + 3000) bad.push(`${s}:${i + 1} дыра ${f - a[i - 1][1]} мс`)
    const ws = w?.[i]
    if (ws?.length && (ws[0][1] < f - 500 || ws[ws.length - 1][2] > t + 500)) bad.push(`${s}:${i + 1} слова вне аята`)
  }
  return bad
}

const index = existsSync(join(OUT, 'index.json')) ? JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8')) : {}
const only = process.argv.slice(2)
for (const [key, src] of Object.entries(SOURCES)) {
  if (only.length && !only.includes(key)) continue
  const dir = join(OUT, key)
  mkdirSync(dir, { recursive: true })
  const u = [], b = [], issues = [], noTiming = []
  let words = 0
  for (let s = 1; s <= 114; s += 6) {
    const batch = []
    for (let k = s; k < Math.min(s + 6, 115); k++) {
      batch.push((async () => {
        const r = src.qdc ? await qdc(src.qdc, k) : src.mp3q ? await mp3q(src, k) : { url: src.folder + pad(k) + '.mp3' }
        if (r.a) {
          const bad = check(key, k, r.a, r.w)
          if (bad.length) issues.push(...bad)
          const out = { a: r.a }
          if (r.w?.some((x) => x.length)) { out.w = r.w; words += r.w.reduce((n, x) => n + x.length, 0) }
          writeFileSync(join(dir, `${pad(k)}.json`), JSON.stringify(out))
        }
        else noTiming.push(k)
        if (r.missing) issues.push('нет разметки ' + r.missing)
        u[k - 1] = r.url
        b[k - 1] = await size(r.url)
      })())
    }
    await Promise.all(batch)
  }
  // n — суры без разметки (их доделывает align-recitation.py и убирает из списка)
  index[key] = { u, b, w: words > 0, n: noTiming.sort((x, y) => x - y) }
  const gb = (b.reduce((x, y) => x + y, 0) / 1e9).toFixed(2)
  console.log(`${key}: ${gb} ГБ, слов с разметкой: ${words}, сбоев: ${issues.length}`)
  if (issues.length) console.log('   ' + issues.slice(0, 12).join('\n   '))
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index))
