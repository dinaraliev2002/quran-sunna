// Кладёт шрифты страниц мусхафа в dist/fonts/<вариант>/pN.woff2 — они попадут внутрь приложения из магазина.
//   node scripts/bundle-fonts.mjs v2 v4c   (Android: обычный и с таджвидом)
//   node scripts/bundle-fonts.mjs v2        (iPhone: только обычный; таджвид скачивается из «Загрузок»)
// Запускается после `npm run build` и до `cap sync`. Источник — тот же CDN, что и в src/lib/fonts.ts.
import fs from 'node:fs'
import path from 'node:path'

const URLS = {
  v2: (p) => `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p${p}.woff2`,
  v4c: (p) => `https://verses.quran.foundation/fonts/quran/hafs/v4/colrv1/woff2/p${p}.woff2`,
}
const variants = process.argv.slice(2)
if (!variants.length || variants.some((v) => !URLS[v])) { console.error('Нужно: v2 и/или v4c'); process.exit(1) }
const OUT = path.resolve(import.meta.dirname, '..', 'dist', 'fonts')

const jobs = variants.flatMap((v) => Array.from({ length: 604 }, (_, i) => [v, i + 1]))
let i = 0, done = 0
async function one([v, p]) {
  const file = path.join(OUT, v, `p${p}.woff2`)
  if (fs.existsSync(file) && fs.statSync(file).size > 500) return
  fs.mkdirSync(path.dirname(file), { recursive: true })
  for (let t = 0; t < 5; t++) {
    try {
      const r = await fetch(URLS[v](p), { signal: AbortSignal.timeout(60000) })
      if (!r.ok) throw new Error(r.status)
      const b = Buffer.from(await r.arrayBuffer())
      if (b.length < 500) throw new Error('short')
      fs.writeFileSync(file, b); done++; return
    } catch (e) { if (t === 4) throw new Error(`${v} p${p}: ${e.message}`); await new Promise((r) => setTimeout(r, 1500 * (t + 1))) }
  }
}
await Promise.all(Array.from({ length: 12 }, async () => { while (i < jobs.length) await one(jobs[i++]) }))
console.log(`Шрифты в dist/fonts: ${variants.join(', ')} (новых файлов: ${done})`)
