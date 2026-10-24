import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../components/Icon'
import { Sheet, SheetHead } from '../../components/ui'
import { autoCuts, baseOf, bodyWords, LONG3_WORDS, partsOf, ruWords, splitItem, type HifzItem, type Split } from '../../lib/hifz'
import { haptic } from '../../lib/telegram'
import { useStore } from '../../store/settings'

/** Меньше стольких слов в части — разрез не ставим */
const MIN_PART = 3
const MAX_PARTS = 6

/**
 * Как учить хадис: целиком, поровну на 2–3 части или по своим разрезам («Свои…» открывает редактор).
 * Если по хадису уже есть прогресс — сначала спрашиваем: он начнётся заново.
 */
export function SplitControl({ item: given, onChange }: { item: HifzItem; onChange?: (parts: HifzItem[]) => void }) {
  const item = given.whole ?? given // у части — целый хадис, из которого она вырезана
  const cur = useStore((s) => s.hzSplit[item.key])
  const started = useStore((s) => Object.keys(s.hifz).some((k) => baseOf(k) === item.key))
  const setSplit = useStore((s) => s.hifzSplit)
  const [ask, setAsk] = useState<Split | null>(null)
  const [edit, setEdit] = useState(false)
  const words = bodyWords(item)
  const presets = words > LONG3_WORDS ? [1, 2, 3] : [1, 2]
  const apply = (v: Split) => {
    haptic.tap()
    setSplit(item.key, v)
    setAsk(null)
    onChange?.(partsOf(v) > 1 ? splitItem(item, v) : [item])
  }
  const pick = (v: Split) => (started ? setAsk(v) : apply(v))
  const custom = Array.isArray(cur)
  return (
    <>
      <div className="sortseg hz-split-seg">
        {presets.map((n) => (
          <button key={n} className={!custom && partsOf(cur) === n ? 'on' : ''} onClick={() => !(!custom && partsOf(cur) === n) && pick(n)}>{n === 1 ? 'Целиком' : `${n} части`}</button>
        ))}
        <button className={custom ? 'on' : ''} onClick={() => { haptic.tick(); setEdit(true) }}>{custom ? `Свои · ${partsOf(cur)}` : 'Свои…'}</button>
      </div>
      {ask !== null && (
        <div className="hz-ask">
          <span>Прогресс по этому хадису начнётся заново.</span>
          <button onClick={() => setAsk(null)}>Отмена</button>
          <button className="go" onClick={() => apply(ask)}>Изменить</button>
        </div>
      )}
      {edit && createPortal(<SplitEditor item={item} initial={custom ? cur : autoCuts(item, Math.max(2, partsOf(cur)))} onClose={() => setEdit(false)} onSave={(cuts) => { setEdit(false); pick(cuts.length ? cuts : 1) }} />, document.body)}
    </>
  )
}

/** Свои части: нажатие на слово ставит (или убирает) разрез перед ним */
function SplitEditor({ item, initial, onClose, onSave }: { item: HifzItem; initial: number[]; onClose: () => void; onSave: (cuts: number[]) => void }) {
  const words = useMemo(() => ruWords(item), [item])
  const [cuts, setCuts] = useState<number[]>(initial)
  const toggle = (i: number) => {
    if (i === 0) return
    if (cuts.includes(i)) { haptic.tick(); setCuts(cuts.filter((c) => c !== i)); return }
    const next = [...cuts, i].sort((a, b) => a - b)
    const bounds = [0, ...next, words.length]
    const tooSmall = bounds.some((b, k) => k > 0 && b - bounds[k - 1] < MIN_PART)
    if (tooSmall || next.length + 1 > MAX_PARTS) { haptic.tap(); return }
    haptic.tick()
    setCuts(next)
  }
  // номер части для каждого слова
  const partOf = (i: number) => cuts.filter((c) => c <= i).length
  const n = cuts.length + 1
  const preset = (k: number) => { haptic.tick(); setCuts(k > 1 ? autoCuts(item, k) : []) }
  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="Свои части" sub={n > 1 ? `${n} ${n < 5 ? 'части' : 'частей'}` : 'Пока целиком'} onClose={onClose} />
      <p className="hz-se-tip">Нажмите на слово — с него начнётся новая часть. Нажмите ещё раз, чтобы убрать разрез.</p>
      <div className="hz-se-presets">
        <span>Поровну:</span>
        {[2, 3, 4].filter((k) => words.length >= k * 8).map((k) => <button key={k} onClick={() => preset(k)}>{k}</button>)}
        <button onClick={() => preset(1)}>Сбросить</button>
      </div>
      <div className="body hz-se-text">
        {item.ru.map((p, pi) => {
          const offset = item.ru.slice(0, pi).join(' ').split(/\s+/).filter(Boolean).length
          return (
            <p key={pi}>
              {p.split(/\s+/).filter(Boolean).map((w, wi) => {
                const i = offset + wi
                const isCut = cuts.includes(i)
                return (
                  <span key={wi} className={`hz-se-w p${partOf(i) % 3}`}>
                    {isCut && <span className="hz-se-cut">{partOf(i) + 1}</span>}
                    <button onClick={() => toggle(i)}>{w}</button>{' '}
                  </span>
                )
              })}
            </p>
          )
        })}
      </div>
      <div className="hz-sheet-btns">
        <button className="bigbtn" onClick={() => onSave(cuts)}><Icon id="check" />{n > 1 ? `Учить ${n} частями` : 'Учить целиком'}</button>
      </div>
    </Sheet>
  )
}

/**
 * Маленькая кнопка «Части» рядом с «Слушать»: открывает окошко над собой, где можно в любой момент
 * переключить деление хадиса (целиком / 2 / 3 / свои). Меняется и когда хадис уже разделён.
 */
export function SplitBtn({ item, onChange }: { item: HifzItem; onChange: (parts: HifzItem[]) => void }) {
  const whole = item.whole ?? item
  const cur = useStore((s) => s.hzSplit[whole.key])
  const n = partsOf(cur)
  const btn = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null)
  const open = () => {
    haptic.tick()
    const r = btn.current!.getBoundingClientRect()
    setPos({ left: Math.max(12, Math.min(r.left, window.innerWidth - 332)), bottom: window.innerHeight - r.top + 8 })
  }
  return (
    <>
      <button ref={btn} className={'hz-parts-btn' + (n > 1 ? ' on' : '')} onClick={() => (pos ? setPos(null) : open())} aria-label="Разделить на части">
        <Icon id="rows" />{n > 1 && <b>{n}</b>}
      </button>
      {pos && createPortal(
        <>
          <div className="hz-pop-dim" onClick={() => setPos(null)} />
          <div className="hz-pop" style={{ left: pos.left, bottom: pos.bottom }}>
            <b>Учить хадис</b>
            <span>{n > 1 ? `Сейчас: ${Array.isArray(cur) ? 'свои части' : 'поровну'}, ${n} ${n < 5 ? 'части' : 'частей'}` : 'Сейчас: целиком'}</span>
            <SplitControl item={whole} onChange={(parts) => { setPos(null); onChange(parts) }} />
          </div>
        </>, document.body)}
    </>
  )
}
