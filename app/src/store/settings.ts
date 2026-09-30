import { create } from 'zustand'
import { cloudGet, cloudGetBoth, cloudSet, localSet } from '../lib/telegram'

export type ReadMode = 'mushaf' | 'page' | 'sura'
export type Translation = 'ku' | 'aa'
export type ThemePref = 'auto' | 'light' | 'dark'

export interface LastRead { s: number; a: number; p: number }

/** Ежедневные дела на главной */
export type TaskId = 'read' | 'morning' | 'evening' | 'memo'
interface Today { d: string; done: TaskId[]; pages: number[]; /** азкары: «глава:азкар» → сколько раз прочитан сегодня */ az?: Record<string, number> }

interface Settings {
  mode: ReadMode
  translation: Translation
  reciter: string
  tajweed: boolean
  wbw: boolean
  arSize: number
  trSize: number
  theme: ThemePref
  // азкары
  azArSize: number
  azTrSize: number
  azShowAr: boolean
  azShowTr: boolean
  azShowRef: boolean
  azAuto: boolean // после последнего повтора — сама к следующей карточке
  azFont: 'sch' | 'hafs' | 'amiri' // шрифт арабского текста азкаров
  // хадисы
  hdArSize: number
  hdTrSize: number
  hdAr: boolean
}

interface Progress {
  lastRead: LastRead | null
  recent: LastRead[] // последние открытые суры (по одной записи на суру)
  streak: number
  lastDay: string // YYYY-MM-DD последнего дня чтения
  today: Today
  /** где остановились в сборнике хадисов */
  hadithLast: { c: string; n: number; i: number } | null
}

interface Store extends Settings, Progress {
  bookmarks: string[] // "сура:аят"
  hfav: string[] // избранные хадисы (см. lib/hadith favBook/favEnc)
  hydrated: boolean
  set: (patch: Partial<Settings>) => void
  setLastRead: (lr: LastRead) => void
  toggleBookmark: (key: string) => void
  markPage: (p: number) => void
  markTask: (id: TaskId, done?: boolean) => void
  /** наступил новый день → обнулить «Сегодня» и проверить серию */
  rollDay: () => void
  /** +1 к счётчику азкара (не больше нужного числа повторов); вернёт новое значение */
  azkarTap: (ch: number, item: number, rep: number) => number
  azkarReset: (ch: number, items: number[]) => void
  toggleHadithFav: (key: string) => void
  setHadithLast: (v: { c: string; n: number; i: number }) => void
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
  azArSize: 26,
  azTrSize: 17,
  azShowAr: true,
  azShowTr: true,
  azShowRef: true,
  azAuto: true,
  azFont: 'sch',
  hdArSize: 24,
  hdTrSize: 17,
  hdAr: false, // арабский текст хадисов — по умолчанию выключен (новое имя, чтобы не взять старое сохранённое «вкл»)
}
// YYYY-MM-DD в местном времени (вручную — не зависим от языковых форматов браузера)
const dayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const emptyToday = (): Today => ({ d: dayStr(), done: [], pages: [] })
const DEFAULT_PROGRESS: Progress = { lastRead: null, recent: [], streak: 0, lastDay: '', today: emptyToday(), hadithLast: null }

// Отдельные ключи: у CloudStorage Telegram лимит 4096 символов на значение
const SETTINGS_KEY = 'settings_v1'
const PROGRESS_KEY = 'progress_v2'
const BOOKMARKS_KEY = 'bookmarks_v1'
const HFAV_KEY = 'hadith_fav_v1'

const pick = <T extends object>(obj: T, keys: (keyof T)[]) => Object.fromEntries(keys.map((k) => [k, obj[k]]))

// Сохранение: на телефон — сразу (ничего не теряется, даже если приложение тут же закрыли),
// в облако Telegram — с небольшой задержкой и сразу при сворачивании приложения.
// В каждую запись кладём время (_t), чтобы при запуске взять более свежую копию.
let saveTimer: ReturnType<typeof setTimeout> | undefined
let pending: [string, string][] = []
function snapshot(s: Store): [string, string][] {
  const t = Date.now()
  return [
    [SETTINGS_KEY, JSON.stringify({ ...pick(s, Object.keys(DEFAULT_SETTINGS) as (keyof Store)[]), _t: t })],
    [PROGRESS_KEY, JSON.stringify({ ...pick(s, Object.keys(DEFAULT_PROGRESS) as (keyof Store)[]), _t: t })],
    [BOOKMARKS_KEY, s.bookmarks.join(',')],
    [HFAV_KEY, favString(s.hfav)],
  ]
}
function flushCloud() {
  clearTimeout(saveTimer)
  pending.forEach(([k, v]) => cloudSet(k, v))
  pending = []
}
function persist(s: Store) {
  pending = snapshot(s)
  pending.forEach(([k, v]) => localSet(k, v))
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flushCloud, 600)
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushCloud() })
  window.addEventListener('pagehide', flushCloud)
}

/** Избранное одной строкой — в пределах лимита облака Telegram (4096 символов); старые записи отбрасываются */
function favString(list: string[]) {
  let out = ''
  for (const k of list) {
    if (out.length + k.length + 1 > 4000) break
    out += (out ? ',' : '') + k
  }
  return out
}

/** Сегодняшняя запись (если наступил новый день — пустая) */
const currentToday = (t: Today) => (t.d === dayStr() ? t : emptyToday())

export const useStore = create<Store>((set, get) => ({
  ...DEFAULT_SETTINGS,
  ...DEFAULT_PROGRESS,
  bookmarks: [],
  hfav: [],
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
  rollDay: () => {
    const { today, lastDay, streak } = get()
    const patch: Partial<Progress> = {}
    if (today.d !== dayStr()) patch.today = emptyToday()
    const yesterday = dayStr(new Date(Date.now() - 864e5))
    if (streak && lastDay && lastDay !== dayStr() && lastDay !== yesterday) patch.streak = 0
    if (Object.keys(patch).length) { set(patch); persist(get()) }
  },
  azkarTap: (ch, item, rep) => {
    const today = currentToday(get().today)
    const key = `${ch}:${item}`
    const az = { ...(today.az ?? {}) }
    const n = Math.min(rep, (az[key] ?? 0) + 1)
    az[key] = n
    set({ today: { ...today, az } })
    persist(get())
    return n
  },
  azkarReset: (ch, items) => {
    const today = currentToday(get().today)
    const az = { ...(today.az ?? {}) }
    items.forEach((i) => delete az[`${ch}:${i}`])
    set({ today: { ...today, az } })
    persist(get())
  },
  toggleHadithFav: (key) => {
    const f = get().hfav
    set({ hfav: f.includes(key) ? f.filter((x) => x !== key) : [key, ...f] })
    persist(get())
  },
  setHadithLast: (v) => {
    const cur = get().hadithLast
    if (cur && cur.c === v.c && cur.n === v.n && cur.i === v.i) return
    set({ hadithLast: v })
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
  const parse = (v: string | null) => { try { return v ? JSON.parse(v) : {} } catch { return {} } }
  // из двух копий (телефон / облако Telegram) берём более свежую — по времени сохранения _t
  const newest = async (key: string) => {
    const { local, cloud } = await cloudGetBoth(key)
    const l = parse(local), c = parse(cloud)
    return JSON.stringify((l._t ?? 0) >= (c._t ?? 0) && local ? l : cloud ? c : l)
  }
  const [s, p, b, old, hf] = await Promise.all([newest(SETTINGS_KEY), newest(PROGRESS_KEY), cloudGet(BOOKMARKS_KEY), cloudGet('progress_v1'), cloudGet(HFAV_KEY)])
  const legacy = parse(old) // первая версия хранила всё в одном ключе
  const progress: Progress = { ...DEFAULT_PROGRESS, ...pick(legacy, ['lastRead', 'streak', 'lastDay']), ...parse(p) }
  progress.today = currentToday(progress.today ?? emptyToday())
  // серия обрывается, если вчера не читали
  const yesterday = dayStr(new Date(Date.now() - 864e5))
  if (progress.lastDay && progress.lastDay !== dayStr() && progress.lastDay !== yesterday) progress.streak = 0
  const bookmarks = b ? b.split(',').filter(Boolean) : Array.isArray(legacy.bookmarks) ? legacy.bookmarks : []
  const settings = parse(s)
  delete settings._t
  delete (progress as unknown as { _t?: number })._t
  const hfav = hf ? hf.split(',').filter(Boolean) : []
  useStore.setState({ ...DEFAULT_SETTINGS, ...settings, ...progress, bookmarks, hfav, hydrated: true })
}

// Telegram держит приложение в памяти — проверяем смену дня при каждом возвращении и раз в минуту
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') useStore.getState().rollDay() })
  setInterval(() => useStore.getState().rollDay(), 60_000)
}
