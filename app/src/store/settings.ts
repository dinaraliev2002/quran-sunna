import { create } from 'zustand'
import { cloudGet, cloudSet } from '../lib/telegram'

export type ReadMode = 'mushaf' | 'page' | 'sura'
export type Translation = 'ku' | 'aa'
export type ThemePref = 'auto' | 'light' | 'dark'

export interface LastRead { s: number; a: number; p: number }

/** Ежедневные дела на главной */
export type TaskId = 'read' | 'morning' | 'evening' | 'memo'
interface Today { d: string; done: TaskId[]; pages: number[] }

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
  recent: LastRead[] // последние открытые суры (по одной записи на суру)
  streak: number
  lastDay: string // YYYY-MM-DD последнего дня чтения
  today: Today
}

interface Store extends Settings, Progress {
  bookmarks: string[] // "сура:аят"
  hydrated: boolean
  set: (patch: Partial<Settings>) => void
  setLastRead: (lr: LastRead) => void
  toggleBookmark: (key: string) => void
  markPage: (p: number) => void
  markTask: (id: TaskId, done?: boolean) => void
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
const dayStr = (d = new Date()) => d.toLocaleDateString('sv') // YYYY-MM-DD в местном времени
const emptyToday = (): Today => ({ d: dayStr(), done: [], pages: [] })
const DEFAULT_PROGRESS: Progress = { lastRead: null, recent: [], streak: 0, lastDay: '', today: emptyToday() }

// Отдельные ключи: у CloudStorage Telegram лимит 4096 символов на значение
const SETTINGS_KEY = 'settings_v1'
const PROGRESS_KEY = 'progress_v2'
const BOOKMARKS_KEY = 'bookmarks_v1'

const pick = <T extends object>(obj: T, keys: (keyof T)[]) => Object.fromEntries(keys.map((k) => [k, obj[k]]))

let saveTimer: ReturnType<typeof setTimeout> | undefined
function persist(s: Store) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    cloudSet(SETTINGS_KEY, JSON.stringify(pick(s, Object.keys(DEFAULT_SETTINGS) as (keyof Store)[])))
    cloudSet(PROGRESS_KEY, JSON.stringify(pick(s, Object.keys(DEFAULT_PROGRESS) as (keyof Store)[])))
    cloudSet(BOOKMARKS_KEY, s.bookmarks.join(','))
  }, 600)
}

/** Сегодняшняя запись (если наступил новый день — пустая) */
const currentToday = (t: Today) => (t.d === dayStr() ? t : emptyToday())

export const useStore = create<Store>((set, get) => ({
  ...DEFAULT_SETTINGS,
  ...DEFAULT_PROGRESS,
  bookmarks: [],
  hydrated: false,
  set: (patch) => { set(patch); persist(get()) },
  setLastRead: (lastRead) => {
    const recent = [lastRead, ...get().recent.filter((r) => r.s !== lastRead.s)].slice(0, 5)
    set({ lastRead, recent })
    persist(get())
  },
  toggleBookmark: (key) => {
    const b = get().bookmarks
    set({ bookmarks: b.includes(key) ? b.filter((x) => x !== key) : [key, ...b].slice(0, 400) })
    persist(get())
  },
  markPage: (p) => {
    const today = currentToday(get().today)
    if (today.pages.includes(p)) { if (today !== get().today) set({ today }); return }
    const pages = [...today.pages, p].slice(-120)
    const done = today.done.includes('read') ? today.done : [...today.done, 'read' as TaskId]
    // серия дней: сегодня читали → +1 к вчерашней серии
    const { lastDay, streak } = get()
    const t = dayStr()
    const streakPatch = lastDay === t ? {} : { lastDay: t, streak: lastDay === dayStr(new Date(Date.now() - 864e5)) ? streak + 1 : 1 }
    set({ today: { ...today, pages, done }, ...streakPatch })
    persist(get())
  },
  markTask: (id, done) => {
    const today = currentToday(get().today)
    const has = today.done.includes(id)
    const want = done ?? !has
    if (want === has) return
    set({ today: { ...today, done: want ? [...today.done, id] : today.done.filter((x) => x !== id) } })
    persist(get())
  },
}))

export async function hydrateStore() {
  const [s, p, b, old] = await Promise.all([cloudGet(SETTINGS_KEY), cloudGet(PROGRESS_KEY), cloudGet(BOOKMARKS_KEY), cloudGet('progress_v1')])
  const parse = (v: string | null) => { try { return v ? JSON.parse(v) : {} } catch { return {} } }
  const legacy = parse(old) // первая версия хранила всё в одном ключе
  const progress: Progress = { ...DEFAULT_PROGRESS, ...pick(legacy, ['lastRead', 'streak', 'lastDay']), ...parse(p) }
  progress.today = currentToday(progress.today ?? emptyToday())
  // серия обрывается, если вчера не читали
  const yesterday = dayStr(new Date(Date.now() - 864e5))
  if (progress.lastDay && progress.lastDay !== dayStr() && progress.lastDay !== yesterday) progress.streak = 0
  const bookmarks = b ? b.split(',').filter(Boolean) : Array.isArray(legacy.bookmarks) ? legacy.bookmarks : []
  useStore.setState({ ...DEFAULT_SETTINGS, ...parse(s), ...progress, bookmarks, hydrated: true })
}
