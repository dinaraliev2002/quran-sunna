import { create } from 'zustand'
import { cachedBlob } from '../lib/net'

// Чтецы: аудио по аятам (everyayah.com) + зеркало (quranicaudio). Если источник не отвечает — берём следующий.
export const RECITERS: Record<string, { name: string; folder: string }> = {
  alafasy: { name: 'Мишари аль-Афаси', folder: 'Alafasy_128kbps' },
  husary_m: { name: 'аль-Хусари (муаллим)', folder: 'Husary_Muallim_128kbps' },
  sudais: { name: 'Абдуррахман ас-Судайс', folder: 'Abdurrahmaan_As-Sudais_192kbps' },
  shuraym: { name: 'Сауд аш-Шурайм', folder: 'Saood_ash-Shuraym_128kbps' },
  shatri: { name: 'Абу Бакр аш-Шатри', folder: 'Abu_Bakr_Ash-Shaatree_128kbps' },
}
const MIRRORS = ['https://everyayah.com/data/', 'https://mirrors.quranicaudio.com/everyayah/']

export const audioFile = (key: string) => {
  const [s, a] = key.split(':').map(Number)
  return String(s).padStart(3, '0') + String(a).padStart(3, '0') + '.mp3'
}
export const audioUrls = (reciter: string, key: string) => MIRRORS.map((m) => m + (RECITERS[reciter] ?? RECITERS.alafasy).folder + '/' + audioFile(key))
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
