import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../lib/telegram'
import { useStore } from '../store/settings'

/** Шаг экскурса: el — что подсветить (CSS-селектор; нет на экране — шаг пропускается),
 *  без el — пояснение по центру экрана (жест, общий смысл раздела) */
export interface TourStep { el?: string; title: string; text: string }

// первый подходящий элемент на экране по горизонтали (соседние страницы листалки лежат за краем — их не берём);
// по вертикали он может быть ниже — тогда прокрутим к нему (если экскурсу можно прокручивать экран)
const visible = (sel: string, scroll: boolean) => {
  for (const el of document.querySelectorAll<HTMLElement>(sel)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth && (scroll || (r.top >= 0 && r.bottom <= window.innerHeight))) return el
  }
  return null
}

/**
 * Экскурс по разделу: при первом заходе по очереди подсвечивает кнопки и объясняет, что они делают.
 * Показывается один раз (id запоминается в настройках); «Показать подсказки снова» — в настройках приложения.
 * ready — экран загрузился (подсвечиваемые элементы уже на месте).
 * scroll — можно прокрутить экран к элементу; в читалке нельзя: собьётся место «Продолжить чтение».
 */
export function Tour({ id, steps, ready = true, scroll = true }: { id: string; steps: TourStep[]; ready?: boolean; scroll?: boolean }) {
  const seen = useStore((s) => s.tours.includes(id))
  const [list, setList] = useState<TourStep[] | null>(null)
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  // начать чуть позже — пока экран дорисуется; шаги без своего элемента на экране отбрасываем
  useEffect(() => {
    if (seen || !ready) return
    const t = setTimeout(() => setList(steps.filter((s) => !s.el || visible(s.el, scroll))), 700)
    return () => clearTimeout(t)
  }, [seen, ready]) // steps пересоздаются на каждой отрисовке — берём те, что были на момент старта

  const step = list?.[i]
  // подсвечиваемый элемент — прокрутить в видимую часть и измерить
  useLayoutEffect(() => {
    if (!step?.el) { setRect(null); return }
    const el = visible(step.el, scroll)
    if (!el) { setRect(null); return }
    if (scroll) { const r = el.getBoundingClientRect(); if (r.top < 0 || r.bottom > window.innerHeight - 200) el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' as ScrollBehavior }) }
    const measure = () => setRect(el.getBoundingClientRect())
    measure()
    const t = setTimeout(measure, 120)
    window.addEventListener('resize', measure)
    return () => { clearTimeout(t); window.removeEventListener('resize', measure) }
  }, [step])

  if (seen || !list || !step) return null
  const finish = () => {
    const st = useStore.getState()
    st.set({ tours: [...st.tours.filter((x) => x !== id), id] })
    setList(null)
  }
  const next = () => { haptic.tap(); if (i + 1 < list.length) setI(i + 1); else finish() }

  // карточка с пояснением — под элементом, а если внизу мало места — над ним
  const pad = 8
  const below = rect ? rect.bottom + 190 < window.innerHeight : true
  const cardStyle: React.CSSProperties = rect
    ? below ? { top: rect.bottom + pad + 10 } : { bottom: window.innerHeight - rect.top + pad + 10 }
    : { top: '50%', transform: 'translateY(-50%)' }

  return createPortal(
    <div className="tour" onClick={next}>
      {rect
        ? <div className="tour-hole" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
        : <div className="tour-dim" />}
      <div className="tour-card" style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div className="tour-n">{i + 1} из {list.length}</div>
        <b>{step.title}</b>
        <p>{step.text}</p>
        <div className="tour-btns">
          {i + 1 < list.length && <button className="skip" onClick={() => { haptic.tap(); finish() }}>Пропустить</button>}
          <button className="go" onClick={next}>{i + 1 < list.length ? 'Далее' : 'Понятно'}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
