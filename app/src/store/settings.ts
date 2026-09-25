import { create } from 'zustand'
import { cloudGet, cloudSet } from '../lib/telegram'

export type ReadMode = 'mushaf' | 'page' | 'sura'
export type Translation = 'ku' | 'aa'
export type ThemePref = 'auto' | 'light' | 'dark'

export interface LastRead { s: number; a: number; p: number }

interface Settings {
  mode: ReadMode
  translation: Translation
  reciter: string
  tajweed: boolean
  wbw: boolean
  arSize: number
  trSize: number
  theme: ThemePref
}

interface Progress {
  lastRead: LastRead | null
  bookmarks: string[] // "сура:аят"
  streak: number
  lastDay: string // YYYY-MM-DD последнего дня чтения
}

interface Store extends Settings, Progress {
  hydrated: boolean
  set: (patch: Partial<Settings>) => void
  setLastRead: (lr: LastRead) => void
  toggleBookmark: (key: string) => void
  markToday: () => void
}

const DEFAULT_SETTINGS: Settings = {
  mode: 'sura',
  translation: 'ku',
  reciter: 'alafasy',
  tajweed: true,
  wbw: false,
  arSize: 28,
  trSize: 16,
  theme: 'auto',
}
const DEFAULT_PROGRESS: Progress = { lastRead: null, bookmarks: [], streak: 0, lastDay: '' }

const SETTINGS_KEY = 'settings_v1'
const PROGRESS_KEY = 'progress_v1'

const pick = <T extends object>(obj: T, keys: (keyof T)[]) => Object.fromEntries(keys.map((k) => [k, obj[k]]))
const today = () => new Date().toLocaleDateString('sv') // YYYY-MM-DD в местном времени

let saveTimer: ReturnType<typeof setTimeout> | undefined
function persist(s: Store) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    cloudSet(SETTINGS_KEY, JSON.stringify(pick(s, Object.keys(DEFAULT_SETTINGS) as (keyof Store)[])))
    cloudSet(PROGRESS_KEY, JSON.stringify(pick(s, Object.keys(DEFAULT_PROGRESS) as (keyof Store)[])))
  }, 600)
}

export const useStore = create<Store>((set, get) => ({
  ...DEFAULT_SETTINGS,
  ...DEFAULT_PROGRESS,
  hydrated: false,
  set: (patch) => { set(patch); persist(get()) },
  setLastRead: (lastRead) => { set({ lastRead }); persist(get()) },
  toggleBookmark: (key) => {
    const b = get().bookmarks
    set({ bookmarks: b.includes(key) ? b.filter((x) => x !== key) : [key, ...b].slice(0, 300) })
    persist(get())
  },
  markToday: () => {
    const { lastDay, streak } = get()
    const t = today()
    if (lastDay === t) return
    const yesterday = new Date(Date.now() - 864e5).toLocaleDateString('sv')
    set({ lastDay: t, streak: lastDay === yesterday ? streak + 1 : 1 })
    persist(get())
  },
}))

export async function hydrateStore() {
  const [s, p] = await Promise.all([cloudGet(SETTINGS_KEY), cloudGet(PROGRESS_KEY)])
  const parse = (v: string | null) => { try { return v ? JSON.parse(v) : {} } catch { return {} } }
  const progress = { ...DEFAULT_PROGRESS, ...parse(p) }
  // серия обрывается, если вчера не читали
  const yesterday = new Date(Date.now() - 864e5).toLocaleDateString('sv')
  if (progress.lastDay && progress.lastDay !== today() && progress.lastDay !== yesterday) progress.streak = 0
  useStore.setState({ ...DEFAULT_SETTINGS, ...parse(s), ...progress, hydrated: true })
}
