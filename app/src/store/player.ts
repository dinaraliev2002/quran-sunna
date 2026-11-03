import { create } from 'zustand'
import { cachedBlob } from '../lib/net'

// Чтецы: аудио по аятам (everyayah.com) + зеркало (quranicaudio). Если источник не отвечает — берём следующий.
// У большинства чтецов на everyayah есть несколько вариантов качества (кбит/с) — 64 вдвое легче 128, на слух для речи почти то же.
export interface Reciter { name: string; /** папка на everyayah по качеству, кбит/с */ folders: Record<number, string>; def: number }
export const RECITERS: Record<string, Reciter> = {
  alafasy: { name: 'Мишари аль-Афаси', folders: { 64: 'Alafasy_64kbps', 128: 'Alafasy_128kbps' }, def: 128 },
  husary_m: { name: 'аль-Хусари (муаллим)', folders: { 128: 'Husary_Muallim_128kbps' }, def: 128 },
  sudais: { name: 'Абдуррахман ас-Судайс', folders: { 64: 'Abdurrahmaan_As-Sudais_64kbps', 192: 'Abdurrahmaan_As-Sudais_192kbps' }, def: 192 },
  shuraym: { name: 'Сауд аш-Шурайм', folders: { 64: 'Saood_ash-Shuraym_64kbps', 128: 'Saood_ash-Shuraym_128kbps' }, def: 128 },
  shatri: { name: 'Абу Бакр аш-Шатри', folders: { 64: 'Abu_Bakr_Ash-Shaatree_64kbps', 128: 'Abu_Bakr_Ash-Shaatree_128kbps' }, def: 128 },
  dosari: { name: 'Ясир ад-Даусари', folders: { 128: 'Yasser_Ad-Dussary_128kbps' }, def: 128 },
  muaiqly: { name: 'Махир аль-Муайкли', folders: { 64: 'Maher_AlMuaiqly_64kbps', 128: 'MaherAlMuaiqly128kbps' }, def: 128 },
  juhani: { name: 'Абдуллах аль-Джухани', folders: { 128: 'Abdullaah_3awwaad_Al-Juhaynee_128kbps' }, def: 128 },
  qatami: { name: 'Насир аль-Катами', folders: { 128: 'Nasser_Alqatami_128kbps' }, def: 128 },
  ayman: { name: 'Аймен Сувейд', folders: { 64: 'Ayman_Sowaid_64kbps' }, def: 64 },
}
/** Какое качество играет у чтеца: выбранное, а если такого у него нет — по умолчанию */
export const bitrateOf = (reciter: string, chosen?: Record<string, number>) => {
  const r = RECITERS[reciter] ?? RECITERS.alafasy
  const c = chosen?.[reciter]
  return c && r.folders[c] ? c : r.def
}
let bitrates: Record<string, number> = {}
export const setBitrates = (b: Record<string, number>) => { bitrates = b }
const folderOf = (reciter: string) => { const r = RECITERS[reciter] ?? RECITERS.alafasy; return r.folders[bitrateOf(reciter, bitrates)] }
const MIRRORS = ['https://everyayah.com/data/', 'https://mirrors.quranicaudio.com/everyayah/']

export const audioFile = (key: string) => {
  const [s, a] = key.split(':').map(Number)
  return String(s).padStart(3, '0') + String(a).padStart(3, '0') + '.mp3'
}
export const audioUrls = (reciter: string, key: string) => MIRRORS.map((m) => m + folderOf(reciter) + '/' + audioFile(key))
export const audioKey = (reciter: string, key: string) => `audio:${reciter}:${audioFile(key).slice(0, 6)}`
const urls = audioUrls

export type PauseMode = 0 | 2000 | 5000 | 'len'
export interface MemoOptions { repeatEach: number; repeatRange: number; pause: PauseMode; hideText: boolean }

/** Настройки плеера (из «Настройки плеера»); обновляются из lib/listen.ts */
export const playerCfg = { gap: 0, next: 'stop' as 'stop' | 'next' | 'repeat', rate: 1, surahCount: (_s: number): number => 0 }
export type Sleep = { mode: 'time'; until: number } | { mode: 'suras'; left: number }

interface PlayerState {
  sleep: Sleep | null
  setSleep: (s: Sleep | null) => void
  status: 'idle' | 'loading' | 'playing' | 'paused'
  queue: string[]
  index: number
  current: string | null
  memo: (MemoOptions & { each: number; round: number }) | null
  error: string | null
  play: (queue: string[], start?: number, memo?: MemoOptions | null) => void
  toggle: () => void
  stop: () => void
}

// два плеера: пока играет один, второй уже загрузил следующий аят — на стыке нет паузы
const els = [new Audio(), new Audio()]
let audio = els[0]
// короткая тишина: «разблокирует» звук на iPhone в момент нажатия, пока ищем файл аята
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='
const isSilent = () => audio.src.startsWith('data:')
els.forEach((e) => { e.preload = 'auto' })
const blobOf = new Map<HTMLAudioElement, string | null>() // blob-адрес, занятый плеером (чтобы освободить)
let ready: { key: string; el: HTMLAudioElement } | null = null
let reciter = 'alafasy'
let mirror = 0
let waitTimer: ReturnType<typeof setTimeout> | undefined

export const setReciter = (r: string) => { reciter = r }
/** Скорость чтеца (заучивание: 0.5–1.5); при смене файла браузер берёт defaultPlaybackRate */
let rate = 1
export const setRate = (r: number) => els.forEach((e) => { rate = r; e.defaultPlaybackRate = r; e.playbackRate = r })

// ---------- обычное прослушивание: Web Audio, аяты встык без пауз ----------
// Аяты — отдельные файлы; у <audio> между файлами всегда щель. Поэтому декодируем аяты заранее
// и ставим их в расписание звуковой карты вплотную друг к другу (с точностью до сэмпла).
// Лишнюю тишину в начале и конце файла обрезаем.
interface Clip { buf: AudioBuffer; off: number; dur: number }
const AC: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
let ctx: AudioContext | null = null
let gen = 0 // номер запуска: старые циклы замолкают
let waOn = false
let sources: AudioBufferSourceNode[] = []
const clips = new Map<string, Promise<Clip>>()

async function fetchClip(r: string, key: string): Promise<Clip> {
  let data: ArrayBuffer | null = null
  const blob = await cachedBlob(audioKey(r, key))
  if (blob) data = await blob.arrayBuffer()
  else for (const u of urls(r, key)) {
    try { const res = await fetch(u); if (res.ok) { data = await res.arrayBuffer(); break } } catch { /* следующее зеркало */ }
  }
  if (!data) throw new Error('no audio')
  const buf = await new Promise<AudioBuffer>((ok, bad) => ctx!.decodeAudioData(data!, ok, bad))
  const ch = buf.getChannelData(0), th = 0.004
  let a = 0, b = ch.length - 1
  while (a < b && Math.abs(ch[a]) < th) a++
  while (b > a && Math.abs(ch[b]) < th) b--
  const sr = buf.sampleRate
  const from = Math.max(0, a - Math.round(sr * 0.02)), to = Math.min(ch.length, b + Math.round(sr * 0.06))
  return { buf, off: from / sr, dur: (to - from) / sr }
}
const clipOf = (r: string, key: string) => {
  const id = r + key
  let c = clips.get(id)
  if (!c) { c = fetchClip(r, key); c.catch(() => clips.delete(id)); clips.set(id, c) }
  return c
}
function stopWA() {
  gen++
  waOn = false
  for (const s of sources) { try { s.stop() } catch { /* уже закончился */ } }
  sources = []
}

export const usePlayer = create<PlayerState>((set, get) => {
  let sleepTimer: ReturnType<typeof setTimeout> | undefined
  /** Конец суры: продолжать ли дальше (следующая сура / повтор) с учётом таймера сна */
  function surahEnd(): boolean {
    const s = get()
    if (s.memo || !s.queue.length) return false
    if (s.sleep?.mode === 'suras') {
      const left = s.sleep.left - 1
      if (left <= 0) { set({ sleep: null }); return false }
      set({ sleep: { mode: 'suras', left } })
    }
    const sid = +s.queue[s.queue.length - 1].split(':')[0]
    if (playerCfg.next === 'stop') return false
    const nsid = playerCfg.next === 'repeat' ? sid : sid + 1
    const n = playerCfg.surahCount(nsid)
    if (!n) return false
    set({ queue: [...s.queue, ...Array.from({ length: n }, (_, i) => `${nsid}:${i + 1}`)] })
    return true
  }
  const gapMs = (dur: number) => (playerCfg.gap < 0 ? dur * 1000 : playerCfg.gap)

  async function waRun(start: number) {
    const g = gen
    const r = reciter
    let when = 0
    let n = 0
    try {
      for (let i = start; ; i++) {
        let queue = get().queue
        if (i >= queue.length) {
          if (!surahEnd()) break
          queue = get().queue
        }
        const key = queue[i]
        const c = await clipOf(r, key)
        if (g !== gen) return
        for (let k = 1; k <= 2; k++) if (queue[i + k]) clipOf(r, queue[i + k]).catch(() => {}) // заранее
        // не уходим далеко вперёд по расписанию (пауза замораживает часы звуковой карты)
        while (g === gen && when - ctx!.currentTime > 4) await new Promise((ok) => setTimeout(ok, 250))
        if (g !== gen) return
        const t = Math.max(ctx!.currentTime + 0.03, when)
        const src = ctx!.createBufferSource()
        src.buffer = c.buf
        src.playbackRate.value = rate
        src.connect(ctx!.destination)
        src.start(t, c.off, c.dur)
        sources.push(src)
        src.onended = () => { sources = sources.filter((x) => x !== src) }
        when = t + c.dur / rate + gapMs(c.dur / rate) / 1000
        const first = n++ === 0
        const show = () => { if (g !== gen) return; set({ index: i, current: key, status: ctx!.state === 'running' ? 'playing' : 'paused' }); mediaSession(key) }
        if (first) show(); else setTimeout(show, Math.max(0, (t - ctx!.currentTime) * 1000))
        // чистим память: старые аяты не держим
        const old = queue[i - 3]
        if (old) clips.delete(r + old)
      }
      while (g === gen && ctx!.currentTime < when) await new Promise((ok) => setTimeout(ok, 150))
      if (g === gen) { waOn = false; clearTimeout(sleepTimer); set({ status: 'idle', current: null, memo: null, sleep: null }) }
    } catch {
      if (g === gen) set({ status: 'paused', error: 'Не удалось загрузить аудио. Проверьте интернет.' })
    }
  }

  async function load(i: number) {
    const { queue } = get()
    const key = queue[i]
    mirror = 0
    set({ index: i, current: key, status: 'loading', error: null })
    // следующий аят уже подготовлен вторым плеером — включаем его без паузы
    if (ready && ready.key === key && ready.el !== audio) {
      const old = audio
      audio = ready.el
      ready = null
      audio.currentTime = 0
      audio.play().catch(() => { /* ошибка обработается в onerror */ })
      old.pause()
      prepare(i)
      mediaSession(key)
      return
    }
    ready = null
    // скачанный аят берём с телефона — мгновенно и без интернета
    const blob = await cachedBlob(audioKey(reciter, key))
    if (get().current !== key) return // пока искали, уже переключили
    release(audio)
    const obj = blob ? URL.createObjectURL(blob) : null
    blobOf.set(audio, obj)
    audio.src = obj ?? urls(reciter, key)[0]
    audio.play().catch(() => { /* ошибка обработается в onerror */ })
    prepare(i)
    mediaSession(key)
  }

  function release(el: HTMLAudioElement) {
    const u = blobOf.get(el)
    if (u) URL.revokeObjectURL(u)
    blobOf.set(el, null)
  }

  /** Загрузить следующий аят во втором плеере, пока играет текущий */
  async function prepare(i: number) {
    const next = get().queue[i + 1]
    if (!next) return
    const el = els.find((e) => e !== audio)!
    const blob = await cachedBlob(audioKey(reciter, next))
    if (get().queue[i] !== get().current || audio === el) return
    release(el)
    const obj = blob ? URL.createObjectURL(blob) : null
    blobOf.set(el, obj)
    el.src = obj ?? urls(reciter, next)[0]
    el.load()
    ready = { key: next, el }
  }

  function advance() {
    const s = get()
    const m = s.memo
    if (m) {
      if (m.each < m.repeatEach) { set({ memo: { ...m, each: m.each + 1 } }); return replay() }
      const last = s.index >= s.queue.length - 1
      if (!last) { set({ memo: { ...m, each: 1 } }); return load(s.index + 1) }
      const endless = m.repeatRange === 0
      if (endless || m.round < m.repeatRange) { set({ memo: { ...m, each: 1, round: m.round + 1 } }); return load(0) }
      return finish()
    }
    if (s.index < s.queue.length - 1 || surahEnd()) load(s.index + 1)
    else finish()
  }

  function replay() {
    audio.currentTime = 0
    audio.play().catch(() => {})
  }

  function finish() {
    clearTimeout(sleepTimer)
    set({ status: 'idle', current: null, memo: null, sleep: null })
  }

  for (const el of els) {
    el.onplaying = () => { if (el === audio && !isSilent()) set({ status: 'playing' }) }
    el.onpause = () => { if (el === audio && get().status === 'playing') set({ status: 'paused' }) }
    el.onerror = () => {
      if (el !== audio) return
      const key = get().current
      if (!key || isSilent()) return
      const list = urls(reciter, key)
      if (audio.src.startsWith('blob:')) { audio.src = list[0]; audio.play().catch(() => {}); return }
      if (++mirror < list.length) { audio.src = list[mirror]; audio.play().catch(() => {}); return }
      set({ status: 'paused', error: 'Не удалось загрузить аудио. Проверьте интернет.' })
    }
    el.onended = () => {
      if (el !== audio || isSilent()) return
      const m = get().memo
      const pause = m ? m.pause : 0
      const ms = m ? (pause === 'len' ? audio.duration * 1000 : pause) : gapMs(audio.duration / (audio.playbackRate || 1))
      if (ms > 0) { set({ status: 'loading' }); waitTimer = setTimeout(advance, ms) } else advance()
    }
  }

  return {
    sleep: null,
    setSleep: (sl) => {
      clearTimeout(sleepTimer)
      set({ sleep: sl })
      if (sl?.mode === 'time') sleepTimer = setTimeout(() => { usePlayer.getState().stop() }, Math.max(0, sl.until - Date.now()))
    },
    status: 'idle',
    queue: [],
    index: 0,
    current: null,
    memo: null,
    error: null,
    play: (queue, start = 0, memo = null) => {
      clearTimeout(waitTimer)
      stopWA()
      if (!memo) setRate(playerCfg.rate)
      if (!memo && AC && playerCfg.rate === 1) {
        // без повторов — встык через Web Audio
        for (const el of els) { el.pause(); el.removeAttribute('src') }
        ready = null
        ctx = ctx ?? new AC()
        ctx.resume().catch(() => {})
        waOn = true
        window.dispatchEvent(new Event('quran-play'))
        set({ queue, memo: null, index: start, current: queue[start], status: 'loading', error: null })
        waRun(start)
        return
      }
      set({ queue, memo: memo ? { ...memo, each: 1, round: 1 } : null })
      window.dispatchEvent(new Event('quran-play')) // остановить аудио азкара, если играет
      ready = null
      for (const el of els) { el.src = SILENT; el.play().catch(() => {}) }
      load(start)
    },
    toggle: () => {
      const s = get()
      if (waOn && ctx) {
        if (ctx.state === 'running') { ctx.suspend(); set({ status: 'paused' }) } else { ctx.resume(); set({ status: 'playing' }) }
        return
      }
      if (s.status === 'playing' || s.status === 'loading') { clearTimeout(waitTimer); audio.pause(); set({ status: 'paused' }) }
      else if (s.current) { set({ status: 'loading' }); audio.play().catch(() => {}) }
    },
    stop: () => { clearTimeout(waitTimer); clearTimeout(sleepTimer); stopWA(); ctx?.resume().catch(() => {}); ready = null; for (const el of els) { el.pause(); el.removeAttribute('src') }; set({ status: 'idle', current: null, memo: null, queue: [], sleep: null }) },
  }
})

let titleOf: (key: string) => string = (k) => k
export const setMediaTitle = (fn: (key: string) => string) => { titleOf = fn }

function mediaSession(key: string) {
  if (!('mediaSession' in navigator)) return
  navigator.mediaSession.metadata = new MediaMetadata({ title: titleOf(key), artist: (RECITERS[reciter] ?? RECITERS.alafasy).name, album: 'Коран' })
  navigator.mediaSession.setActionHandler('play', () => usePlayer.getState().toggle())
  navigator.mediaSession.setActionHandler('pause', () => usePlayer.getState().toggle())
  navigator.mediaSession.setActionHandler('stop', () => usePlayer.getState().stop())
}
