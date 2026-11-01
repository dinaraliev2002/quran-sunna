import { create } from 'zustand'
import { baseOf, dayNum, schedule, type Grade, type HifzCard, type MyHifz, type SetId, type Split } from '../lib/hifz'
import { cloudGet, cloudGetBoth, cloudSet, localSet } from '../lib/telegram'

export type ReadMode = 'mushaf' | 'page' | 'sura'
export type Translation = 'ku' | 'aa'
export type ThemePref = 'auto' | 'light' | 'dark'

export interface LastRead { s: number; a: number; p: number }

/** Ежедневные дела на главной */
export type TaskId = 'read' | 'morning' | 'evening' | 'memo'
interface Today { d: string; done: TaskId[]; pages: number[]; /** азкары: «глава:азкар» → сколько раз прочитан сегодня */ az?: Record<string, number>; /** заучивание: хадисы, выученные сегодня впервые */ hz?: string[] }

interface Settings {
  /** пройденные экскурсы по разделам (подсказки показываются один раз) */
  tours: string[]
  mode: ReadMode
  translation: Translation
  reciter: string
  /** качество аудио по чтецам, кбит/с: { alafasy: 64 } (нет записи — как у чтеца по умолчанию) */
  bitrates: Record<string, number>
  /** закладки в «Историях»: отрывки «сура:первый аят» */
  storyMarks: string[]
  tajweed: boolean
  /** пословный перевод в чтении (режимы «Страница» и «Сура») */
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
  // заучивание
  hzPerDay: number // план: новых хадисов в день
  hzDrills: boolean // упражнения при заучивании: пропуски, первые буквы, сборка
  hzAr: boolean // показывать арабский текст при чтении
  hzSet: SetId // набор, из которого берутся новые хадисы
  hzRate: number // скорость озвучки хадисов
}

interface Progress {
  lastRead: LastRead | null
  recent: LastRead[] // последние открытые суры (по одной записи на суру)
  streak: number
  lastDay: string // YYYY-MM-DD последнего дня чтения
  today: Today
  /** где остановились в сборнике хадисов */
  hadithLast: { c: string; n: number; i: number } | null
  /** где остановились в разделе «Истории аятов»: сура и первый аят отрывка */
  storyLast: { s: number; a: number } | null
  // статистика для профиля
  since: number // день первого входа (номер дня, lib/hifz dayNum)
  totalPages: number // сколько раз за всё время засчитана прочитанная страница (по одной в день на страницу)
  bestStreak: number
}

/** Активность по дням: номер дня → [страниц прочитано, хадисов выучено, повторов сделано] */
export type Activity = Record<number, [number, number, number]>

interface Store extends Settings, Progress {
  bookmarks: string[] // "сура:аят"
  hfav: string[] // избранные хадисы (см. lib/hadith favBook/favEnc)
  learned: number[] // выученные имена Аллаха (номера)
  hifz: Record<string, HifzCard> // заучивание: ключ хадиса (lib/hifz) → ступень и день повтора
  myHifz: MyHifz[] // «Мой набор» для заучивания
  hzSplit: Record<string, Split> // длинные хадисы: ключ → на сколько частей разбит (или свои разрезы)
  act: Activity // активность по дням (последние ~20 недель)
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
  setStoryLast: (v: { s: number; a: number }) => void
  /** отметить имя выученным / снять отметку */
  setLearned: (n: number, on: boolean) => void
  /** хадис выучен впервые → повтор завтра */
  hifzLearn: (key: string) => void
  /** оценка при повторе */
  hifzGrade: (key: string, grade: Grade) => void
  /** начать хадис заново (убрать из повторения) — вместе с его частями */
  hifzReset: (key: string) => void
  /** учить хадис целиком (1), частями поровну (2, 3) или по своим разрезам; прогресс по хадису начинается заново */
  hifzSplit: (key: string, v: Split) => void
  /** добавить хадис в «Мой набор»; false — набор заполнен */
  myHifzAdd: (ref: string, q: string) => boolean
  myHifzRemove: (ref: string) => void
  myHifzEdit: (id: number, q: string) => void
}

const DEFAULT_SETTINGS: Settings = {
  tours: [],
  mode: 'sura',
  translation: 'ku',
  reciter: 'alafasy',
  bitrates: {},
  storyMarks: [],
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
  hzPerDay: 1,
  hzDrills: false,
  hzAr: false,
  hzSet: 'nawawi',
  hzRate: 1,
  hdAr: false, // арабский текст хадисов — по умолчанию выключен (новое имя, чтобы не взять старое сохранённое «вкл»)
}
// YYYY-MM-DD в местном времени (вручную — не зависим от языковых форматов браузера)
export const dayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const emptyToday = (): Today => ({ d: dayStr(), done: [], pages: [] })
const DEFAULT_PROGRESS: Progress = { lastRead: null, recent: [], streak: 0, lastDay: '', today: emptyToday(), hadithLast: null, storyLast: null, since: 0, totalPages: 0, bestStreak: 0 }

// Отдельные ключи: у CloudStorage Telegram лимит 4096 символов на значение
const SETTINGS_KEY = 'settings_v1'
const PROGRESS_KEY = 'progress_v2'
const BOOKMARKS_KEY = 'bookmarks_v1'
const HFAV_KEY = 'hadith_fav_v1'
const NAMES_KEY = 'names_learned_v1'
const HIFZ_KEY = 'hifz_v1'
const MY_HIFZ_KEY = 'hifz_my_v1'
const ACT_KEY = 'activity_v1'
const ACT_DAYS = 140

// только заданные поля: «пустое» значение не должно затирать значение по умолчанию (иначе у нового пользователя серия = undefined)
const pick = <T extends object>(obj: T, keys: (keyof T)[]) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]))

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
    [NAMES_KEY, s.learned.join(',')],
    [HIFZ_KEY, JSON.stringify({ c: hifzString(s.hifz), p: Object.entries(s.hzSplit).map(([k, v]) => `${k}:${Array.isArray(v) ? 'c' + v.join('.') : v}`).join(','), _t: t })],
    [MY_HIFZ_KEY, myString(s.myHifz, t)],
    [ACT_KEY, JSON.stringify({ a: Object.entries(s.act).map(([d, v]) => `${d}:${v.join(':')}`).join(','), _t: t })],
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

/** Заучивание одной строкой: «n1:2:20391,n2:0:20385» (ключ:ступень:день повтора) */
const hifzString = (h: Record<string, HifzCard>) => Object.entries(h).map(([k, c]) => `${k}:${c.s}:${c.d}`).join(',')
/** «Мой набор»: [[номер, откуда, подсказка], …] — в пределах лимита облака Telegram */
const myString = (list: MyHifz[], t: number) => JSON.stringify({ l: list.map((m) => [m.id, m.r, m.q]), _t: t })
const MY_LIMIT = 4000
function parseHifz(v: string): Record<string, HifzCard> {
  const out: Record<string, HifzCard> = {}
  for (const part of v.split(',')) {
    const [k, s, d] = part.split(':')
    if (k && Number.isFinite(+s) && +d > 0) out[k] = { s: +s, d: +d }
  }
  return out
}

/** +1 к активности сегодняшнего дня (0 — страницы, 1 — новые хадисы, 2 — повторы); старше ACT_DAYS — отбрасываем */
function bumpAct(act: Activity, i: 0 | 1 | 2): Activity {
  const d = dayNum()
  const out: Activity = {}
  for (const [k, v] of Object.entries(act)) if (+k > d - ACT_DAYS) out[+k] = v
  const cur: [number, number, number] = [...(out[d] ?? [0, 0, 0])] as [number, number, number]
  cur[i]++
  out[d] = cur
  return out
}
function parseAct(v: string): Activity {
  const out: Activity = {}
  for (const part of v.split(',')) {
    const [d, p, n, r] = part.split(':').map(Number)
    if (d > 0) out[d] = [p || 0, n || 0, r || 0]
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
  learned: [],
  hifz: {},
  myHifz: [],
  hzSplit: {},
  act: {},
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
    const st = 'streak' in streakPatch ? streakPatch.streak! : streak
    set({ today: { ...today, pages, done }, ...streakPatch, totalPages: get().totalPages + 1, bestStreak: Math.max(get().bestStreak, st), act: bumpAct(get().act, 0) })
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
  setStoryLast: (v) => {
    const cur = get().storyLast
    if (cur && cur.s === v.s && cur.a === v.a) return
    set({ storyLast: v })
    persist(get())
  },
  setLearned: (n, on) => {
    const l = get().learned
    if (l.includes(n) === on) return
    set({ learned: on ? [...l, n].sort((a, b) => a - b) : l.filter((x) => x !== n) })
    persist(get())
  },
  hifzLearn: (key) => {
    const today = currentToday(get().today)
    const hz = today.hz ?? []
    set({
      hifz: { ...get().hifz, [key]: schedule(undefined, 'good') },
      today: { ...today, hz: hz.includes(key) ? hz : [...hz, key] },
      act: bumpAct(get().act, 1),
    })
    persist(get())
  },
  hifzGrade: (key, grade) => {
    const cur = get().hifz[key]
    set({ hifz: { ...get().hifz, [key]: schedule(cur, grade, dayNum()) }, act: bumpAct(get().act, 2) })
    persist(get())
  },
  hifzReset: (key) => {
    const h = { ...get().hifz }
    for (const k of Object.keys(h)) if (baseOf(k) === baseOf(key)) delete h[k]
    set({ hifz: h })
    persist(get())
  },
  hifzSplit: (key, v) => {
    const h = { ...get().hifz }
    for (const k of Object.keys(h)) if (baseOf(k) === key) delete h[k]
    const sp = { ...get().hzSplit }
    if (Array.isArray(v) ? v.length > 0 : v > 1) sp[key] = v
    else delete sp[key]
    set({ hifz: h, hzSplit: sp })
    persist(get())
  },
  myHifzAdd: (ref, q) => {
    const list = get().myHifz
    if (list.some((m) => m.r === ref)) return true
    const next = [...list, { id: Math.max(0, ...list.map((m) => m.id)) + 1, r: ref, q: q.trim() }]
    if (myString(next, Date.now()).length > MY_LIMIT) return false
    set({ myHifz: next })
    persist(get())
    return true
  },
  myHifzRemove: (ref) => {
    const m = get().myHifz.find((x) => x.r === ref)
    if (!m) return
    const h = { ...get().hifz }
    for (const k of Object.keys(h)) if (baseOf(k) === 'u' + m.id) delete h[k]
    const sp = { ...get().hzSplit }
    delete sp['u' + m.id]
    set({ myHifz: get().myHifz.filter((x) => x !== m), hifz: h, hzSplit: sp })
    persist(get())
  },
  myHifzEdit: (id, q) => {
    set({ myHifz: get().myHifz.map((m) => (m.id === id ? { ...m, q: q.trim() } : m)) })
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
  const [s, p, b, old, hf, nl, hz, my, ac] = await Promise.all([newest(SETTINGS_KEY), newest(PROGRESS_KEY), cloudGet(BOOKMARKS_KEY), cloudGet('progress_v1'), cloudGet(HFAV_KEY), cloudGet(NAMES_KEY), newest(HIFZ_KEY), newest(MY_HIFZ_KEY), newest(ACT_KEY)])
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
  const learned = nl ? nl.split(',').map(Number).filter((x) => x > 0 && x <= 99) : []
  const hifz = parseHifz(String(parse(hz).c ?? ''))
  // «n2:3» — поровну на 3 части, «n2:c45.120» — свои разрезы
  const hzSplit: Record<string, Split> = {}
  for (const part of String(parse(hz).p ?? '').split(',')) {
    const [k, v] = part.split(':')
    if (!k || !v) continue
    if (v[0] === 'c') { const cuts = v.slice(1).split('.').map(Number).filter((x) => x > 0); if (cuts.length) hzSplit[k] = cuts }
    else if (+v > 1) hzSplit[k] = +v
  }
  const myRaw = parse(my).l
  const myHifz: MyHifz[] = Array.isArray(myRaw) ? myRaw.filter((x) => Array.isArray(x) && x.length === 3).map(([id, r, q]) => ({ id: Number(id), r: String(r), q: String(q) })) : []
  const act = parseAct(String(parse(ac).a ?? ''))
  if (!progress.since) progress.since = dayNum() // первый вход — «с нами N дней» считается отсюда
  progress.bestStreak = Math.max(progress.bestStreak ?? 0, progress.streak)
  useStore.setState({ ...DEFAULT_SETTINGS, ...settings, ...progress, bookmarks, hfav, learned, hifz, myHifz, hzSplit, act, hydrated: true })
}

// Telegram держит приложение в памяти — проверяем смену дня при каждом возвращении и раз в минуту
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') useStore.getState().rollDay() })
  setInterval(() => useStore.getState().rollDay(), 60_000)
}
