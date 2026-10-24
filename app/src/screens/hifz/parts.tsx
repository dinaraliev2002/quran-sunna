import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Sheet, SheetHead } from '../../components/ui'
import { dayNum, hadithProgress, MAX_NEW, partsOf, setById, type HifzItem } from '../../lib/hifz'
import { haptic } from '../../lib/telegram'
import { dayStr, useStore } from '../../store/settings'

/** Что на сегодня: хадисы на повтор (из всех наборов), сколько новых осталось по плану (из выбранного набора) */
export function useHifzToday() {
  const hifz = useStore((s) => s.hifz)
  const plan = useStore((s) => s.hzPerDay)
  const today = useStore((s) => s.today)
  const my = useStore((s) => s.myHifz)
  const set = setById(useStore((s) => s.hzSet))
  const d = dayNum()
  const due = Object.entries(hifz).filter(([, c]) => c.d <= d).map(([k]) => k)
  const learnedToday = today.d === dayStr() ? (today.hz?.length ?? 0) : 0
  const split = useStore((s) => s.hzSplit)
  const total = set.size ?? my.length
  const { started, learned } = hadithProgress(hifz, set.prefix, split)
  // что учится по отдельности: хадис целиком или каждая его часть
  const units = total + Object.entries(split).filter(([k]) => k.startsWith(set.prefix)).reduce((a, [, v]) => a + partsOf(v) - 1, 0)
  const unitsStarted = Object.keys(hifz).filter((k) => k.startsWith(set.prefix)).length
  const newLeft = Math.max(0, Math.min(plan - learnedToday, units - unitsStarted))
  const anyStarted = Object.keys(hifz).length > 0
  return { due, newLeft, learnedToday, plan, started, learned, total, set, anyStarted, allStarted: unitsStarted >= units }
}

/** Предупреждение: больше 5 новых хадисов в день */
export function WarnSheet({ onOk, onClose }: { onOk: () => void; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <div className="hz-warn">
        <span className="hz-warn-ic"><Icon id="info" /></span>
        <b>Больше {MAX_NEW} хадисов в день — это много</b>
        <p>Когда учишь сразу много, хадисы плохо закрепляются, а через несколько дней накапливается слишком много повторений. Лучше меньше, но каждый день.</p>
        <button className="bigbtn" onClick={onClose}>Хорошо, не буду</button>
        <button className="hz-warn-go" onClick={() => { onOk(); onClose() }}>Всё равно продолжить</button>
      </div>
    </Sheet>
  )
}

/** Текст хадиса: вводные слова, перевод, арабский, источник */
export function HadithBody({ item, ar }: { item: HifzItem; ar?: boolean }) {
  return (
    <div className="hz-text">
      {item.intro && <p className="hz-intro">{item.intro}</p>}
      {item.ru.map((p, i) => <p key={i}>{p}</p>)}
      {ar && item.ar.map((p, i) => <p key={'a' + i} className="hz-ar" dir="rtl">{p}</p>)}
      <div className="hz-src">{item.src}</div>
    </div>
  )
}

const RATES = [0.75, 1, 1.25, 1.5]

/** Время начала слов в озвучке (рядом с mp3 лежит .json) — чтобы проигрывать часть хадиса */
const timings = new Map<string, Promise<{ t: number[]; end: number } | null>>()
function loadTimings(src: string) {
  if (!timings.has(src)) timings.set(src, fetch(src.replace('.mp3', '.json')).then((r) => (r.ok ? r.json() : null)).catch(() => null))
  return timings.get(src)!
}

/**
 * «Слушать»: озвучка хадиса (заранее записана нейронным голосом) и скорость; если файла нет — кнопок нет.
 * range — часть хадиса (номера слов): играем только её.
 */
export function ListenBtn({ src, range, lead }: { src?: string; range?: [number, number]; lead?: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const stopAt = useRef(Infinity)
  const startAt = useRef(0)
  const [state, setState] = useState<'idle' | 'load' | 'play' | 'fail'>('idle')
  const rate = useStore((s) => s.hzRate)
  const set = useStore((s) => s.set)
  useEffect(() => () => { audio.current?.pause() }, [])
  useEffect(() => { if (audio.current) audio.current.playbackRate = rate }, [rate])
  if (!src || state === 'fail') return lead ? <div className="hz-listen-row">{lead}</div> : null
  const toggle = async () => {
    haptic.tick()
    if (state === 'play') { audio.current?.pause(); return }
    setState('load')
    if (!audio.current) {
      const a = new Audio(src)
      a.onplaying = () => setState('play')
      a.onpause = () => setState('idle')
      a.onended = () => { setState('idle'); a.currentTime = startAt.current }
      a.onerror = () => setState('fail')
      // конец части — пауза и обратно к её началу
      a.ontimeupdate = () => { if (a.currentTime >= stopAt.current) { a.pause(); a.currentTime = startAt.current } }
      audio.current = a
      if (range) {
        const tm = await loadTimings(src)
        if (tm) {
          startAt.current = (tm.t[range[0]] ?? 0) / 1000
          stopAt.current = range[1] < tm.t.length ? tm.t[range[1]] / 1000 - 0.05 : Infinity
          a.currentTime = startAt.current
        }
      }
    }
    const a = audio.current
    a.playbackRate = rate
    a.play().catch(() => setState('idle'))
  }
  const nextRate = () => { haptic.tick(); set({ hzRate: RATES[(RATES.indexOf(rate) + 1) % RATES.length] ?? 1 }) }
  return (
    <div className="hz-listen-row">
      {lead}
      <button className={'hz-listen' + (state === 'play' ? ' on' : '')} onClick={toggle}>
        <Icon id={state === 'play' ? 'pause' : 'sound'} />{state === 'play' ? 'Пауза' : state === 'load' ? 'Загрузка…' : range ? 'Слушать часть' : 'Слушать'}
      </button>
      <button className="hz-rate" onClick={nextRate} aria-label="Скорость озвучки">{String(rate).replace('.', ',')}×</button>
    </div>
  )
}

/** Точки ступеней повторения (1 → 3 → 7 → 14 → 30 дней) */
export function StageDots({ s, started }: { s: number; started: boolean }) {
  return (
    <span className="hz-dots" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => <i key={i} className={started && i < s ? 'on' : ''} />)}
    </span>
  )
}

/** Кнопка у хадиса при чтении: добавить в «Мой набор» для заучивания */
export function HifzAddBtn({ hadithRef, suggest }: { hadithRef: string; suggest: string }) {
  const inSet = useStore((s) => s.myHifz.some((m) => m.r === hadithRef))
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className={inSet ? 'on' : ''} onClick={() => { haptic.tap(); setOpen(true) }} aria-label={inSet ? 'В наборе для заучивания' : 'Добавить к заучиванию'}>
        <Icon id="brain" />
      </button>
      {/* окно — поверх страницы, а не внутри ряда кнопок у хадиса (иначе наследует их стиль) */}
      {open && createPortal(<HifzAddSheet hadithRef={hadithRef} suggest={suggest} onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}

function HifzAddSheet({ hadithRef, suggest, onClose }: { hadithRef: string; suggest: string; onClose: () => void }) {
  const nav = useNavigate()
  const st = useStore()
  const mine = st.myHifz.find((m) => m.r === hadithRef)
  const [q, setQ] = useState(mine?.q ?? '')
  const [full, setFull] = useState(false)
  const save = () => {
    const text = q.trim() || suggest
    if (mine) { st.myHifzEdit(mine.id, text); onClose(); return }
    if (!st.myHifzAdd(hadithRef, text)) { setFull(true); return }
    haptic.success()
    onClose()
  }
  return (
    <Sheet onClose={onClose}>
      <SheetHead title={mine ? 'В моём наборе' : 'Учить этот хадис'} sub="Мой набор для заучивания" onClose={onClose} />
      <div className="hz-add">
        <label>О чём этот хадис?</label>
        <p>Эта подсказка появится при повторении: «Расскажи хадис …». Текст хадиса будет скрыт.</p>
        <div className="hz-add-in">
          <span>Расскажи хадис</span>
          <textarea rows={2} value={q} onChange={(e) => setQ(e.target.value)} placeholder={suggest || 'например: о важности намерения'} maxLength={90} />
        </div>
        {full && <p className="hz-add-full">Набор заполнен: в нём помещается около 40 хадисов. Уберите выученные, чтобы добавить новые.</p>}
        <button className="bigbtn" onClick={save} disabled={!q.trim() && !suggest}><Icon id="check" />{mine ? 'Сохранить' : 'Добавить в мой набор'}</button>
        {mine && <button className="hz-warn-go" onClick={() => { st.set({ hzSet: 'my' }); nav('/hifz') }}>Открыть «Мой набор»</button>}
        {mine && <button className="hz-warn-go danger" onClick={() => { st.myHifzRemove(hadithRef); onClose() }}>Убрать из набора</button>}
      </div>
    </Sheet>
  )
}
