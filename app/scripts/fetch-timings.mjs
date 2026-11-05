// Тайминги слов для подсветки при воспроизведении аудио → public/data/timing/<чтец>/NNN.json
// Источник: Quran.com API (verses/by_chapter?audio=…), сегменты слов. У этих чтецов файлы на everyayah.com
// те же (по размеру совпадают), поэтому тайминги подходят к тому, что играет приложение.
//   node scripts/fetch-timings.mjs
// Формат файла суры: { "<аят>": [[слово, начало_мс, конец_мс], …] }, слова нумеруются с 1.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
// ключ чтеца в приложении → номер записи на Quran.com
const RECITERS = { alafasy: 7, husary_m: 12, sudais: 3, shatri: 4, shuraym: 10 }
const pad = (n) => String(n).padStart(3, '0')

async function chapter(rid, c) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(`https://api.quran.com/api/v4/verses/by_chapter/${c}?audio=${rid}&per_page=300&fields=verse_key`)
      if (!r.ok) throw new Error(String(r.status))
      const d = await r.json()
      const out = {}
      for (const v of d.verses) {
        const segs = v.audio?.segments
        if (segs?.length) out[v.verse_key.split(':')[1]] = segs.map((s) => [s[1], s[2], s[3]])
      }
      return out
    } catch (e) {
      if (attempt === 3) throw e
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)))
    }
  }
}

for (const [key, rid] of Object.entries(RECITERS)) {
  const dir = join(root, 'public', 'data', 'timing', key)
  mkdirSync(dir, { recursive: true })
  let verses = 0, bytes = 0
  for (let c = 1; c <= 114; c += 4) {
    const batch = []
    for (let k = c; k < Math.min(c + 4, 115); k++) batch.push(chapter(rid, k).then((o) => ({ k, o })))
    for (const { k, o } of await Promise.all(batch)) {
      const txt = JSON.stringify(o)
      writeFileSync(join(dir, `${pad(k)}.json`), txt)
      verses += Object.keys(o).length; bytes += txt.length
    }
  }
  console.log(`${key}: ${verses} аятов, ${(bytes / 1024).toFixed(0)} КБ`)
}
