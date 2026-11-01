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
  muaiqly: { name: 'Махир аль-Муайкли', folders: { 128: 'MaherAlMuaiqly128kbps' }, def: 128 },
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

interface PlayerState {
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

const audio = new Audio()
// короткая тишина: «разблокирует» звук на iPhone в момент нажатия, пока ищем файл аята
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='
const isSilent = () => audio.src.startsWith('data:')
audio.preload = 'auto'
const preloader = new Audio()
preloader.preload = 'auto'
let reciter = 'alafasy'
let mirror = 0
let waitTimer: ReturnType<typeof setTimeout> | undefined

export const setReciter = (r: string) => { reciter = r }

export const usePlayer = create<PlayerState>((set, get) => {
  let objectUrl: string | null = null
  async function load(i: number) {
    const { queue } = get()
    const key = queue[i]
    mirror = 0
    set({ index: i, current: key, status: 'loading', error: null })
    // скачанный аят берём с телефона — мгновенно и без интернета
    const blob = await cachedBlob(audioKey(reciter, key))
    if (get().current !== key) return // пока искали, уже переключили
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    objectUrl = blob ? URL.createObjectURL(blob) : null
    audio.src = objectUrl ?? urls(reciter, key)[0]
    audio.play().catch(() => { /* ошибка обработается в onerror */ })
    if (queue[i + 1]) cachedBlob(audioKey(reciter, queue[i + 1])).then((b) => { if (!b) preloader.src = urls(reciter, queue[i + 1])[0] })
    mediaSession(key)
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
    if (s.index < s.queue.length - 1) load(s.index + 1)
    else finish()
  }

  function replay() {
    audio.currentTime = 0
    audio.play().catch(() => {})
  }

  function finish() {
    set({ status: 'idle', current: null, memo: null })
  }

  audio.onplaying = () => { if (!isSilent()) set({ status: 'playing' }) }
  audio.onpause = () => { if (get().status === 'playing') set({ status: 'paused' }) }
  audio.onerror = () => {
    const key = get().current
    if (!key || isSilent()) return
    const list = urls(reciter, key)
    if (audio.src.startsWith('blob:')) { audio.src = list[0]; audio.play().catch(() => {}); return }
    if (++mirror < list.length) { audio.src = list[mirror]; audio.play().catch(() => {}); return }
    set({ status: 'paused', error: 'Не удалось загрузить аудио. Проверьте интернет.' })
  }
  audio.onended = () => {
    if (isSilent()) return
    const m = get().memo
    const pause = m?.pause ?? 0
    const ms = pause === 'len' ? audio.duration * 1000 : pause
    if (ms > 0) { set({ status: 'loading' }); waitTimer = setTimeout(advance, ms) } else advance()
  }

  return {
    status: 'idle',
    queue: [],
    index: 0,
    current: null,
    memo: null,
    error: null,
    play: (queue, start = 0, memo = null) => {
      clearTimeout(waitTimer)
      set({ queue, memo: memo ? { ...memo, each: 1, round: 1 } : null })
      window.dispatchEvent(new Event('quran-play')) // остановить аудио азкара, если играет
      audio.src = SILENT
      audio.play().catch(() => {})
      load(start)
    },
    toggle: () => {
      const s = get()
      if (s.status === 'playing' || s.status === 'loading') { clearTimeout(waitTimer); audio.pause(); set({ status: 'paused' }) }
      else if (s.current) { set({ status: 'loading' }); audio.play().catch(() => {}) }
    },
    stop: () => { clearTimeout(waitTimer); audio.pause(); audio.removeAttribute('src'); set({ status: 'idle', current: null, memo: null, queue: [] }) },
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
