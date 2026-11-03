// Скачивает аудио тафсира ас-Саади (musulmanin.com, 288 файлов) на диск: node scripts/fetch-saadi-audio.mjs [папка]
import fs from 'node:fs'
import path from 'node:path'
const OUT = process.argv[2] || 'D:/tafsir-saadi-audio'
const list = fs.readFileSync(process.argv[3] || 'C:/Users/emila/AppData/Local/Temp/saadi_list.txt', 'utf8').split('\n').filter(Boolean)
fs.mkdirSync(OUT, { recursive: true })
let done = 0, skip = 0, bytes = 0; const failed = []
async function one(u) {
  const url = u.replace('http://', 'https://'); const f = path.join(OUT, path.basename(u))
  if (fs.existsSync(f) && fs.statSync(f).size > 5000) { skip++; return }
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(180000), redirect: 'follow' })
      if (!r.ok) throw new Error(r.status)
      const b = Buffer.from(await r.arrayBuffer()); if (b.length < 5000) throw new Error('short')
      fs.writeFileSync(f + '.part', b); fs.renameSync(f + '.part', f); bytes += b.length; done++; return
    } catch { await new Promise((r) => setTimeout(r, 2000 * (t + 1))) }
  }
  failed.push(u)
}
let i = 0
const tick = setInterval(() => console.log(`скачано ${done}, пропущено ${skip}, ошибок ${failed.length} из ${list.length}; ${(bytes / 1e6).toFixed(0)} МБ`), 20000)
await Promise.all(Array.from({ length: 4 }, async () => { while (i < list.length) await one(list[i++]) }))
clearInterval(tick)
fs.writeFileSync(path.join(OUT, 'failed.txt'), failed.join('\n'))
console.log(`ГОТОВО: ${done} новых, ${skip} пропущено, ошибок ${failed.length}; ${(bytes / 1e6).toFixed(0)} МБ`)
