// Копия аудио чтецов на диск: node scripts/backup-audio.mjs [папка] — докачивает, уже скачанное пропускает.
// Источник — everyayah.com (запасной — зеркало quranicaudio). Список чтецов совпадает с RECITERS в src/store/player.ts.
import fs from 'node:fs'
import path from 'node:path'

const OUT = process.argv[2] || 'D:/quran-audio'
const FOLDERS = [
  'Alafasy_64kbps', 'Alafasy_128kbps', 'Husary_Muallim_128kbps',
  'Abdurrahmaan_As-Sudais_64kbps', 'Abdurrahmaan_As-Sudais_192kbps',
  'Saood_ash-Shuraym_64kbps', 'Saood_ash-Shuraym_128kbps',
  'Abu_Bakr_Ash-Shaatree_64kbps', 'Abu_Bakr_Ash-Shaatree_128kbps',
  'Yasser_Ad-Dussary_128kbps', 'Maher_AlMuaiqly_64kbps', 'MaherAlMuaiqly128kbps',
  'Abdullaah_3awwaad_Al-Juhaynee_128kbps', 'Nasser_Alqatami_128kbps', 'Ayman_Sowaid_64kbps',
]
const MIRRORS = ['https://everyayah.com/data/', 'https://mirrors.quranicaudio.com/everyayah/']
const surahs = JSON.parse(fs.readFileSync(new URL('../public/data/surahs.json', import.meta.url), 'utf8'))

const jobs = []
for (const f of FOLDERS) for (const s of surahs) for (let a = 1; a <= s.ayahs; a++) jobs.push([f, String(s.id).padStart(3, '0') + String(a).padStart(3, '0') + '.mp3'])
let done = 0, skipped = 0, failed = [], bytes = 0

async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!r.ok) throw new Error(r.status)
  return Buffer.from(await r.arrayBuffer())
}
async function one([f, name]) {
  const file = path.join(OUT, f, name)
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) { skipped++; return }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  for (let t = 0; t < 4; t++) {
    for (const m of MIRRORS) {
      try {
        const b = await get(m + f + '/' + name)
        if (b.length < 1000) throw new Error('short')
        fs.writeFileSync(file + '.part', b); fs.renameSync(file + '.part', file)
        bytes += b.length; done++; return
      } catch { /* следующее зеркало / повтор */ }
    }
    await new Promise((r) => setTimeout(r, 1500 * (t + 1)))
  }
  failed.push(f + '/' + name)
}
let i = 0
const tick = setInterval(() => console.log(`скачано ${done}, пропущено ${skipped}, ошибок ${failed.length} из ${jobs.length}; ${(bytes / 1e9).toFixed(2)} ГБ`), 30000)
await Promise.all(Array.from({ length: 16 }, async () => { while (i < jobs.length) await one(jobs[i++]) }))
clearInterval(tick)
fs.writeFileSync(path.join(OUT, 'failed.txt'), failed.join('\n'))
console.log(`ГОТОВО: скачано ${done}, пропущено ${skipped}, ошибок ${failed.length}; ${(bytes / 1e9).toFixed(2)} ГБ`)
