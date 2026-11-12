import { create } from 'zustand'
import { cachedBlob } from '../lib/net'
import { localFileUrl, useFiles } from '../lib/nativeFiles'
import { ayahKey, loadReciteIndex, loadTiming, suraKey, surahUrl, timingNow } from '../lib/recite'
import { glueOn, gluePos, glueSounding, glueStart, glueStop, glueSupported, glueToggle } from '../lib/glueAudio'
import type { Reciter, PauseMode, MemoOptions, Sleep, SurahTiming } from '../types/player'
export type { Reciter, PauseMode, MemoOptions, Sleep }

// Плеер Корана. Чтец звучит одной цельной записью на всю суру — между аятами нет пауз и щелчков,
// как в мусхафе-плеерах. Исключение — Афаси (glue): у него чистый звук только в файлах аятов everyayah, поэтому аяты
// ставятся встык через Web Audio (lib/glueAudio.ts, лишняя тишина обрезается); в заучивании и на iPhone играют сами файлы. По разметке (lib/recite.ts) плеер знает, где какой аят: подсвечивает его,
// останавливается в конце диапазона, а в заучивании повторяет аят или отрывок перемоткой к его началу.

export const RECITERS: Record<string, Reciter> = {
  alafasy: { name: 'Мишари аль-Афаси', ayahs: 'Alafasy_128kbps', glue: true },
  husary: { name: 'Махмуд аль-Хусари', ayahs: 'Husary_128kbps' },
  husary_m: { name: 'аль-Хусари (учебная, медленно)', ayahs: 'Husary_Muallim_128kbps' },
  sudais: { name: 'Абдуррахман ас-Судайс', ayahs: 'Abdurrahmaan_As-Sudais_192kbps' },
  shuraym: { name: 'Сауд аш-Шурайм', ayahs: 'Saood_ash-Shuraym_128kbps' },
  shatri: { name: 'Абу Бакр аш-Шатри', ayahs: 'Abu_Bakr_Ash-Shaatree_128kbps' },
  dosari: { name: 'Ясир ад-Даусари', ayahs: 'Yasser_Ad-Dussary_128kbps' },
  muaiqly: { name: 'Махир аль-Муайкли', ayahs: 'MaherAlMuaiqly128kbps' },
  juhani: { name: 'Абдуллах аль-Джухани', ayahs: 'Abdullaah_3awwaad_Al-Juhaynee_128kbps' },
  qatami: { name: 'Насир аль-Катами', ayahs: 'Nasser_Alqatami_128kbps' },
  ayman: { name: 'Аймен Сувейд', ayahs: 'Ayman_Sowaid_64kbps' },
  luhaidan: { name: 'Мухаммад аль-Люхайдан' },
}
/** На сколько мс раньше границы по разметке гасим звук в конце аята */
const END_LEAD = 90
const pad3 = (n: number) => String(n).padStart(3, '0')
/** Файл одного аята на everyayah (запасной путь без разметки) */
const ayahUrl = (rec: string, s: number, a: number) => `https://everyayah.com/data/${RECITERS[rec]?.ayahs ?? RECITERS.alafasy.ayahs}/${pad3(s)}${pad3(a)}.mp3`
/** Адреса файла аята «сура:аят»: everyayah, потом зеркало */
const ayahUrls = (rec: string, key: string) => {
  const [s, a] = key.split(':').map(Number)
  const u = ayahUrl(rec, s, a)
  return [u, u.replace('https://everyayah.com/data/', 'https://mirrors.quranicaudio.com/everyayah/')]
}
/** Звучит ли чтец файлами аятов, а не цельной записью суры */
export const isGlue = (rec: string) => !!RECITERS[rec]?.glue

/** Настройки плеера (из «Настройки плеера»); обновляются из lib/listen.ts */
export const playerCfg = { gap: 0, next: 'stop' as 'stop' | 'next' | 'repeat', rate: 1, surahCount: (_s: number): number => 0 }

interface PlayerState {
  sleep: Sleep | null
  setSleep: (s: Sleep | null) => void
  status: 'idle' | 'loading' | 'playing' | 'paused'
  queue: string[]
  index: number
  current: string | null
  memo: (MemoOptions & { each: number; round: number }) | null
  /** заучивание: играть ровно эти аяты и остановиться — без «следующей суры» и повтора из настроек плеера */
  exact: boolean
  error: string | null
  play: (queue: string[], start?: number, memo?: MemoOptions | null, opts?: { exact?: boolean }) => void
  toggle: () => void
  stop: () => void
}

const el = new Audio()
el.preload = 'auto'
// короткая тишина: «разблокирует» звук на iPhone в момент нажатия, пока ищем запись суры
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='
// iOS 17+: звук приложения — «медиа», а не «звук игры» (не глушится беззвучным режимом)
const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
if (session) try { session.type = 'playback' } catch { /* старая версия */ }

let reciter = 'alafasy'
export const setReciter = (r: string) => { reciter = RECITERS[r] ? r : 'alafasy' }
export const currentReciter = () => reciter

/** Скорость чтеца. У урока заучивания своя (0.5–1.5, setRate(r) на время урока, setRate(null) — вернуть), иначе — из настроек плеера */
let rate = 1
let lessonRate: number | null = null
const applyRate = (r: number) => { rate = r; el.defaultPlaybackRate = r; el.playbackRate = r }
export const setRate = (r: number | null) => { lessonRate = r; applyRate(r ?? playerCfg.rate) }
/** Скорость из настроек плеера поменялась — применить сразу, без перезапуска аята (если идёт не урок со своей скоростью) */
export const refreshRate = () => { if (lessonRate === null) applyRate(playerCfg.rate) }

/** Что загружено в плеер: чья запись какой суры и откуда (интернет / файл на телефоне); a — файл одного аята (запасной путь) */
let file: { rec: string; s: number; a?: number; src: string; local: boolean } | null = null
let timing: SurahTiming | null = null
let blobUrl: string | null = null

const parse = (key: string) => { const [s, a] = key.split(':').map(Number); return { s, a } }

/** Что звучит прямо сейчас: аят и место в записи суры (мс) — для подсветки слов */
export function playbackPos(): { key: string; ms: number } | null {
  if (glueOn()) return gluePos()
  const key = usePlayer.getState().current
  if (!key || !file || el.paused) return null
  return { key, ms: el.currentTime * 1000 }
}

/** Откуда играть суру: скачанный файл на телефоне или интернет */
async function sourceOf(rec: string, s: number): Promise<{ src: string; local: boolean }> {
  if (file && file.rec === rec && file.s === s && !file.a) return { src: file.src, local: file.local }
  const key = suraKey(rec, s)
  if (useFiles) {
    const u = await localFileUrl(key)
    if (u) return { src: u, local: true }
  } else {
    const blob = await cachedBlob(key)
    if (blob) {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
      blobUrl = URL.createObjectURL(blob)
      return { src: blobUrl, local: true }
    }
  }
  const url = surahUrl(await loadReciteIndex(), rec, s)
  if (!url) throw new Error('нет записи')
  return { src: url, local: false }
}

/** Откуда играть файл аята: скачанный на телефоне или интернет */
async function ayahSource(rec: string, s: number, a: number): Promise<{ src: string; local: boolean }> {
  const key = ayahKey(rec, s, a)
  if (useFiles) {
    const u = await localFileUrl(key)
    if (u) return { src: u, local: true }
  } else {
    const blob = await cachedBlob(key)
    if (blob) {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
      blobUrl = URL.createObjectURL(blob)
      return { src: blobUrl, local: true }
    }
  }
  return { src: ayahUrl(rec, s, a), local: false }
}

/** Дождаться, пока плеер узнает длину записи (до этого перематывать нельзя) */
const metadata = () => new Promise<void>((ok, bad) => {
  if (el.readyState >= 1) return ok()
  const done = () => { el.removeEventListener('loadedmetadata', done); el.removeEventListener('error', fail); ok() }
  const fail = () => { el.removeEventListener('loadedmetadata', done); el.removeEventListener('error', fail); bad(new Error('audio')) }
  el.addEventListener('loadedmetadata', done)
  el.addEventListener('error', fail)
})

export const usePlayer = create<PlayerState>((set, get) => {
  let sleepTimer: ReturnType<typeof setTimeout> | undefined
  let waitTimer: ReturnType<typeof setTimeout> | undefined
  let edgeTimer: ReturnType<typeof setTimeout> | undefined
  /** отложенное действие (пауза между аятами); если в паузе нажали «стоп/плей» — выполняем сразу */
  let pending: (() => void) | null = null
  let gen = 0 // номер запуска: устаревшие загрузки ничего не делают
  let busy = false // идёт загрузка/перемотка — конец аята пока не проверяем (иначе повтор сработает дважды)

  const clearTimers = () => { clearTimeout(waitTimer); clearTimeout(edgeTimer); pending = null }

  /** Конец суры: продолжать ли дальше (следующая сура / повтор) с учётом таймера сна */
  function surahEnd(): boolean {
    const s = get()
    if (s.memo || s.exact || !s.queue.length) return false
    // Это конец суры, только если доиграли её ПОСЛЕДНИЙ аят. Иначе один аят (проверка в заучивании, нажатие на аят)
    // после окончания включал всю следующую суру, а таймер сна «после N сур» считал его за суру
    const lastKey = parse(s.queue[s.queue.length - 1])
    const sid = lastKey.s
    const count = playerCfg.surahCount(sid)
    if (count && lastKey.a !== count) return false
    if (s.sleep?.mode === 'suras') {
      const left = s.sleep.left - 1
      if (left <= 0) { set({ sleep: null }); return false }
      set({ sleep: { mode: 'suras', left } })
    }
    if (playerCfg.next === 'stop') return false
    const nsid = playerCfg.next === 'repeat' ? sid : sid + 1
    const n = playerCfg.surahCount(nsid)
    if (!n) return false
    set({ queue: [...s.queue, ...Array.from({ length: n }, (_, i) => `${nsid}:${i + 1}`)] })
    return true
  }
  const gapMs = (dur: number) => (playerCfg.gap < 0 ? dur : playerCfg.gap)

  /** Начать аят очереди с его начала (загрузить запись суры, если другая, и перемотать) */
  async function startAt(i: number) {
    const g = ++gen
    clearTimers()
    const s0 = get()
    const key = s0.queue[i]
    if (!key) return finish()
    const { s, a } = parse(key)
    set({ index: i, current: key, status: 'loading', error: null })
    mediaSession(key)
    busy = true
    try {
      const rec = reciter
      const t = isGlue(rec) ? null : await loadTiming(rec, s).catch(() => null)
      if (g !== gen) return
      // с первого аята в обычном прослушивании — с самого начала записи (истиаза и басмала перед сурой)
      let fromStart = !isGlue(rec) && a === 1 && !s0.memo && s0.queue.length > 1
      timing = t
      const name = (RECITERS[rec] ?? RECITERS.alafasy).name
      if (!t && !fromStart && !RECITERS[rec]?.ayahs) {
        // ни разметки, ни файлов аятов (аль-Люхайдан): отдельный аят не сыграть
        if (s0.memo || s0.queue.length === 1) {
          el.pause()
          set({ status: 'paused', error: `У чтеца ${name} есть только запись суры целиком — для заучивания и повтора аятов выберите другого чтеца.` })
          return
        }
        fromStart = true // обычное прослушивание — сура целиком с начала
      }
      if (!t && !fromStart) {
        // у суры нет разметки, а нужен отдельный аят (с середины, диапазон, заучивание) — файл этого аята
        if (!(file && file.rec === rec && file.s === s && file.a === a)) {
          const r = await ayahSource(rec, s, a)
          if (g !== gen) return
          file = { rec, s, a, ...r }
          el.src = r.src
        }
      } else {
        const src = await sourceOf(rec, s)
        if (g !== gen) return
        if (!file || file.src !== src.src) { file = { rec, s, ...src }; el.src = src.src }
      }
      await metadata()
      if (g !== gen) return
      const from = !t || fromStart ? 0 : t.a[a - 1][0] / 1000
      el.playbackRate = rate
      if (Math.abs(el.currentTime - from) > 0.05) el.currentTime = from
      if (get().status === 'paused') return // пока загружали, нажали паузу
      await el.play()
    } catch {
      if (g === gen && !el.src.startsWith('data:')) set({ status: 'paused', error: 'Не удалось загрузить аудио. Проверьте интернет.' })
    } finally {
      if (g === gen) busy = false
    }
  }

  /** Подождать (пауза между аятами / для повторения), потом сделать next */
  function after(ms: number, next: () => void) {
    if (ms <= 0) return next()
    el.pause()
    set({ status: 'loading' })
    pending = next
    waitTimer = setTimeout(() => { pending = null; next() }, ms)
  }

  /** Перейти к аяту j: если в записи он идёт сразу за звучащим — просто продолжаем, без перемотки (звук не прерывается) */
  function goNext(j: number) {
    const { queue } = get()
    const prev = parse(queue[j - 1]), nx = queue[j] ? parse(queue[j]) : null
    if (nx && !el.paused && timing && nx.s === prev.s && nx.a === prev.a + 1 && file?.s === nx.s) {
      set({ index: j, current: queue[j] })
      mediaSession(queue[j])
      return
    }
    startAt(j)
  }

  /** Аят дозвучал до своего конца */
  function itemEnd() {
    clearTimeout(edgeTimer)
    const s = get()
    const m = s.memo
    const i = s.index
    const sp = timing?.a[parse(s.queue[i]).a - 1]
    const dur = sp ? (sp[1] - sp[0]) / rate : file?.a && el.duration ? (el.duration * 1000) / rate : 0
    if (m) {
      const pause = m.pause === 'len' ? dur : m.pause
      // аяты-связки (первые lead) звучат один раз за круг, остальные — repeatEach раз
      const reps = i < (m.lead ?? 0) ? 1 : m.repeatEach
      if (m.each < reps) { set({ memo: { ...m, each: m.each + 1 } }); return after(pause, () => startAt(i)) }
      if (i < s.queue.length - 1) { set({ memo: { ...m, each: 1 } }); return after(pause, () => goNext(i + 1)) }
      if (m.repeatRange === 0 || m.round < m.repeatRange) { set({ memo: { ...m, each: 1, round: m.round + 1 } }); return after(pause, () => startAt(0)) }
      return finish()
    }
    if (i < s.queue.length - 1 || surahEnd()) after(gapMs(dur), () => goNext(i + 1))
    else finish()
  }

  /** Следим за временем записи: где кончается звучащий аят */
  function check() {
    if (busy || el.paused || !file || !timing) return
    const s = get()
    const key = s.queue[s.index]
    if (!key) return
    const { s: sid, a } = parse(key)
    const sp = timing.a[a - 1]
    if (!sp || file.s !== sid) return
    // последний аят суры в обычном прослушивании дослушиваем до конца записи (событие ended)
    if (!s.memo && a === timing.a.length) return
    // останавливаемся чуть раньше границы: пока команда паузы дойдёт до звука (задержка вывода, таймер), успеет уйти ещё
    // 50–100 мс, и в конце аята было бы слышно начало следующего
    const left = sp[1] - el.currentTime * 1000 - END_LEAD
    if (left <= 0) return itemEnd()
    // точный момент конца аята, чтобы не «зацепить» начало следующего при повторе
    clearTimeout(edgeTimer)
    if (left < 400) edgeTimer = setTimeout(check, Math.max(0, left / rate - 10))
  }

  function finish() {
    gen++
    clearTimers()
    clearTimeout(sleepTimer)
    el.pause()
    set({ status: 'idle', current: null, memo: null, sleep: null })
  }

  el.onplaying = () => { if (!el.src.startsWith('data:')) set({ status: 'playing', error: null }) }
  el.onwaiting = () => { if (get().status === 'playing') set({ status: 'loading' }) }
  el.onpause = () => { if (!el.ended && get().status === 'playing') set({ status: 'paused' }) }
  el.ontimeupdate = check
  el.onerror = () => {
    if (!file || el.src.startsWith('data:') || !get().current) return
    // скачанный файл аята не открылся — играем из интернета
    if (file.a && file.local) {
      file = { ...file, src: ayahUrl(file.rec, file.s, file.a), local: false }
      el.src = file.src
      el.play().catch(() => {})
      return
    }
    // файл аята не открылся на everyayah — берём зеркало
    if (file.a && file.src.startsWith('https://everyayah.com/')) {
      file = { ...file, src: file.src.replace('https://everyayah.com/data/', 'https://mirrors.quranicaudio.com/everyayah/') }
      el.src = file.src
      el.play().catch(() => {})
      return
    }
    // скачанный файл не открылся — играем из интернета
    if (file.local) {
      const f = file
      loadReciteIndex().then((ix) => {
        const url = surahUrl(ix, f.rec, f.s)
        if (!url || file !== f) return
        file = { ...f, src: url, local: false }
        startAt(get().index)
      })
      return
    }
    set({ status: 'paused', error: 'Не удалось загрузить аудио. Проверьте интернет.' })
  }
  el.onended = () => {
    if (!file || el.src.startsWith('data:')) return
    const s = get()
    if (!s.current) return
    // без разметки сура звучит целиком: перескакиваем на её последний аят в очереди
    if (!timing && !file.a) {
      let j = s.index
      while (j + 1 < s.queue.length && parse(s.queue[j + 1]).s === file.s) j++
      set({ index: j, current: s.queue[j] })
    }
    itemEnd()
  }
  setInterval(check, 50)

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
    exact: false,
    error: null,
    play: (queue, start = 0, memo = null, opts) => {
      applyRate(lessonRate ?? playerCfg.rate)
      window.dispatchEvent(new Event('quran-play')) // остановить аудио азкара, если играет
      glueStop()
      set({ queue, memo: memo ? { ...memo, each: 1, round: 1 } : null, exact: !!opts?.exact })
      // аяты встык: обычное прослушивание без повторов и без замедления (с ними — по файлу, как раньше)
      if (!memo && isGlue(reciter) && glueSupported && rate === 1) {
        gen++
        clearTimers()
        el.pause()
        el.removeAttribute('src')
        file = null
        timing = null
        set({ index: start, current: queue[start], status: 'loading', error: null })
        const rec = reciter
        glueStart({
          rec, start,
          queue: () => get().queue,
          more: surahEnd,
          urls: (key) => ayahUrls(rec, key),
          gapMs: (d) => gapMs(d * 1000),
          show: (i, key) => { set({ index: i, current: key, status: glueSounding() ? 'playing' : 'paused' }); mediaSession(key) },
          done: finish,
          fail: () => set({ status: 'paused', error: 'Не удалось загрузить аудио. Проверьте интернет.' }),
        })
        return
      }
      // iPhone: плеер должен впервые зазвучать прямо в момент нажатия — пока ищем запись, играем тишину
      if (!file) { el.src = SILENT; el.play().catch(() => {}) }
      startAt(start)
    },
    toggle: () => {
      const s = get()
      if (glueOn()) { set({ status: glueToggle() ? 'playing' : 'paused' }); return }
      if (s.status === 'playing' || s.status === 'loading') {
        clearTimeout(waitTimer)
        el.pause()
        set({ status: 'paused' })
        return
      }
      if (!s.current) return
      // нажали «плей» во время паузы между аятами — сразу идём дальше
      if (pending) { const p = pending; pending = null; return p() }
      set({ status: 'loading' })
      el.play().catch(() => startAt(s.index))
    },
    stop: () => {
      glueStop()
      gen++
      clearTimers()
      clearTimeout(sleepTimer)
      el.pause()
      el.removeAttribute('src')
      el.load()
      file = null
      timing = null
      if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null }
      set({ status: 'idle', current: null, memo: null, queue: [], sleep: null })
    },
  }
})

/** Разметка звучащей суры (для подсветки слов) */
export const playingTiming = (key: string) => {
  const { s } = parse(key)
  return file?.s === s ? timing ?? timingNow(reciter, s) : null
}

let titleOf: (key: string) => string = (k) => k
export const setMediaTitle = (fn: (key: string) => string) => { titleOf = fn }

function mediaSession(key: string) {
  if (!('mediaSession' in navigator)) return
  // картинка на экране блокировки и в «Пункте управления» (без неё iPhone показывал иконку сайта — молнию из шаблона)
  const art = (f: string) => new URL(f, location.href).href
  navigator.mediaSession.metadata = new MediaMetadata({
    title: titleOf(key), artist: (RECITERS[reciter] ?? RECITERS.alafasy).name, album: 'Коран',
    artwork: [
      { src: art('./cover-256.jpg'), sizes: '256x256', type: 'image/jpeg' },
      { src: art('./cover-512.jpg'), sizes: '512x512', type: 'image/jpeg' },
    ],
  })
  navigator.mediaSession.setActionHandler('play', () => usePlayer.getState().toggle())
  navigator.mediaSession.setActionHandler('pause', () => usePlayer.getState().toggle())
  navigator.mediaSession.setActionHandler('stop', () => usePlayer.getState().stop())
}
