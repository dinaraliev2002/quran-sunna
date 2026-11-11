// Аяты встык: для чтецов, у которых звучит не цельная запись суры, а файлы отдельных аятов (everyayah.com) — у Афаси.
// У <audio> между двумя файлами всегда щель, поэтому аяты декодируем заранее и ставим в расписание звуковой карты
// вплотную друг к другу (Web Audio, точность до сэмпла). Лишнюю тишину в начале и конце каждого файла обрезаем.
// iPhone/iPad: Web Audio там — «звук игры»: его глушит беззвучный режим и он замирает при заблокированном экране,
// поэтому на iOS этот движок не используется (аяты играют через <audio>, см. store/player.ts).
import { cachedBlob } from './net'
import { localFileUrl, useFiles } from './nativeFiles'
import { ayahKey } from './recite'

interface Clip { buf: AudioBuffer; off: number; dur: number }

const AC: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
export const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
/** Можно ли ставить аяты встык через Web Audio на этом устройстве */
export const glueSupported = !!AC && !IOS

let ctx: AudioContext | null = null
let gen = 0 // номер запуска: старые циклы замолкают
let on = false
let sources: AudioBufferSourceNode[] = []
// когда какой аят поставлен в расписание звуковой карты — по этому считаем, на каком месте записи мы сейчас
const timeline: { key: string; t: number; off: number }[] = []
const clips = new Map<string, Promise<Clip>>()

/** Скачанный на телефон файл аята (или null) */
async function localBytes(rec: string, key: string): Promise<ArrayBuffer | null> {
  const [s, a] = key.split(':').map(Number)
  const k = ayahKey(rec, s, a)
  if (useFiles) {
    const u = await localFileUrl(k)
    if (!u) return null
    const r = await fetch(u).catch(() => null)
    return r?.ok ? r.arrayBuffer() : null
  }
  const blob = await cachedBlob(k)
  return blob ? blob.arrayBuffer() : null
}

async function fetchClip(rec: string, key: string, urls: (key: string) => string[]): Promise<Clip> {
  let data = await localBytes(rec, key)
  if (!data) for (const u of urls(key)) {
    try { const res = await fetch(u); if (res.ok) { data = await res.arrayBuffer(); break } } catch { /* следующее зеркало */ }
  }
  if (!data) throw new Error('no audio')
  const buf = await new Promise<AudioBuffer>((ok, bad) => ctx!.decodeAudioData(data!, ok, bad))
  const ch = buf.getChannelData(0)
  const sr = buf.sampleRate
  const trim = (th: number) => {
    let a = 0, b = ch.length - 1
    while (a < b && Math.abs(ch[a]) < th) a++
    while (b > a && Math.abs(ch[b]) < th) b--
    return { a, b }
  }
  let { a, b } = trim(0.004)
  // в записи может быть постоянный тихий фон выше порога — «тишину» в конце файла не видно, и между аятами остаётся пауза.
  // Тогда порог берём от громкости самой записи (−34 дБ от пика)
  if (ch.length - 1 - b < sr * 0.01) {
    let peak = 0
    for (let i = 0; i < ch.length; i++) { const v = Math.abs(ch[i]); if (v > peak) peak = v }
    ;({ a, b } = trim(Math.max(0.004, peak * 0.02)))
  }
  const from = Math.max(0, a - Math.round(sr * 0.02)), to = Math.min(ch.length, b + Math.round(sr * 0.06))
  return { buf, off: from / sr, dur: (to - from) / sr }
}

function clipOf(rec: string, key: string, urls: (key: string) => string[]) {
  const id = rec + key
  let c = clips.get(id)
  if (!c) { c = fetchClip(rec, key, urls); c.catch(() => clips.delete(id)); clips.set(id, c) }
  return c
}

/** Остановить и забыть расписание */
export function glueStop() {
  gen++
  timeline.length = 0
  on = false
  for (const s of sources) { try { s.stop() } catch { /* уже закончился */ } }
  sources = []
  ctx?.resume().catch(() => {})
}

/** Идёт ли сейчас воспроизведение этим движком (в том числе на паузе) */
export const glueOn = () => on
/** Звучит ли (не на паузе) */
export const glueSounding = () => on && ctx?.state === 'running'

/** Пауза / продолжить; возвращает, звучит ли теперь */
export function glueToggle(): boolean {
  if (!ctx) return false
  if (ctx.state === 'running') { ctx.suspend(); return false }
  ctx.resume()
  return true
}

/** Что звучит прямо сейчас: аят и место в его файле (мс) — для подсветки слов */
export function gluePos(): { key: string; ms: number } | null {
  if (!on || !ctx || ctx.state !== 'running') return null
  const now = ctx.currentTime
  for (let i = timeline.length - 1; i >= 0; i--) {
    const c = timeline[i]
    if (c.t <= now) return { key: c.key, ms: ((now - c.t) + c.off) * 1000 }
  }
  return null
}

export interface GlueRun {
  rec: string
  start: number
  /** очередь аятов «сура:аят» (может дополняться: идёт следующая сура) */
  queue: () => string[]
  /** очередь кончилась: дописать следующую суру; false — дальше не играем */
  more: () => boolean
  /** адреса файла аята: сначала everyayah, потом зеркало */
  urls: (key: string) => string[]
  /** пауза после аята, мс (длина аята в секундах) */
  gapMs: (durSec: number) => number
  /** начал звучать аят i */
  show: (i: number, key: string) => void
  /** всё доиграно */
  done: () => void
  /** не загрузилось */
  fail: () => void
}

/** Начать с аята start: вызывать прямо в обработчике нажатия (иначе браузер не даст включить звук) */
export async function glueStart(o: GlueRun) {
  glueStop()
  ctx = ctx ?? new AC!()
  ctx.resume().catch(() => {})
  on = true
  const g = gen
  let when = 0
  let n = 0
  try {
    for (let i = o.start; ; i++) {
      let queue = o.queue()
      if (i >= queue.length) {
        if (!o.more()) break
        queue = o.queue()
      }
      const key = queue[i]
      const c = await clipOf(o.rec, key, o.urls)
      if (g !== gen) return
      for (let k = 1; k <= 2; k++) if (queue[i + k]) clipOf(o.rec, queue[i + k], o.urls).catch(() => {}) // заранее
      // не уходим далеко вперёд по расписанию (пауза замораживает часы звуковой карты)
      while (g === gen && when - ctx.currentTime > 4) await new Promise((ok) => setTimeout(ok, 250))
      if (g !== gen) return
      const t = Math.max(ctx.currentTime + 0.03, when)
      const src = ctx.createBufferSource()
      src.buffer = c.buf
      src.connect(ctx.destination)
      src.start(t, c.off, c.dur)
      timeline.push({ key, t, off: c.off }); if (timeline.length > 6) timeline.shift()
      sources.push(src)
      src.onended = () => { sources = sources.filter((x) => x !== src) }
      when = t + c.dur + o.gapMs(c.dur) / 1000
      const first = n++ === 0
      const show = () => { if (g === gen) o.show(i, key) }
      if (first) show(); else setTimeout(show, Math.max(0, (t - ctx.currentTime) * 1000))
      // чистим память: старые аяты не держим
      const old = queue[i - 3]
      if (old) clips.delete(o.rec + old)
    }
    while (g === gen && ctx.currentTime < when) await new Promise((ok) => setTimeout(ok, 150))
    if (g === gen) { on = false; o.done() }
  } catch {
    if (g === gen) o.fail()
  }
}
