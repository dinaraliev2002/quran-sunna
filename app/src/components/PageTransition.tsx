import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigationType, type Location } from 'react-router-dom'
import './PageTransition.css'

// Переход между экранами — плавное перетекание: старый экран тает, новый проявляется поверх, а его содержимое
// появляется по очереди (сначала заголовок, потом карточки). С нижней панели новый экран чуть вырастает от нажатой кнопки.
// Старый экран остаётся на месте на время перехода (он не пересоздаётся — прокрутка и состояние не теряются).
// Страницы Корана внутри одной суры (/read/…) не анимируются — там своё листание.

/** Откуда нажали: центр кнопки нижней панели и время нажатия (переход, начатый в ближайшие 700 мс, считаем «из кнопки») */
const tap = { x: 0, y: 0, t: 0 }
const keyOf = (l: Location) => (l.pathname.startsWith('/read/') ? '/read' : l.pathname)
const OUT_MS = 160 // старый экран гаснет за 130 мс — после этого убираем
const ENTER_MS = 950 // самая долгая анимация входа (последний блок: задержка .4 с + .5 с) — после неё класс входа снимаем

export function PageTransition({ render }: { render: (loc: Location) => ReactNode }) {
  const loc = useLocation()
  const type = useNavigationType()
  const last = useRef(loc) // адрес предыдущей отрисовки — он станет «уходящим» экраном
  const [st, setSt] = useState<{ key: string; n: number; prev: Location | null; kind: string; ox: number; oy: number }>(
    { key: keyOf(loc), n: 0, prev: null, kind: 'push', ox: 0, oy: 0 })

  const key = keyOf(loc)
  if (st.key !== key) {
    const kind = type === 'POP' ? 'back' : Date.now() - tap.t < 700 ? 'tab' : 'push'
    setSt({ key, n: st.n + 1, prev: last.current, kind, ox: tap.x, oy: tap.y })
  }
  useEffect(() => { last.current = loc })

  // нажатие на кнопку нижней панели запоминаем — от неё «вырастет» новый экран
  useEffect(() => {
    const on = (e: Event) => {
      const a = (e.target as Element | null)?.closest?.('.tabbar a')
      if (!a) return
      const r = a.getBoundingClientRect()
      tap.x = r.left + r.width / 2; tap.y = r.top + r.height / 2; tap.t = Date.now()
    }
    addEventListener('click', on, true)
    return () => removeEventListener('click', on, true)
  }, [])

  // Анимация входа действует только сам переход (ENTER_MS). Иначе её правила цеплялись к окнам, которые экран
  // открывает позже (например, «Заучивание» на главной): окно выезжало, а потом ещё раз проявлялось
  const [entering, setEntering] = useState(false)
  useEffect(() => {
    if (!st.n) return
    setEntering(true)
    const t = setTimeout(() => setEntering(false), ENTER_MS)
    return () => clearTimeout(t)
  }, [st.n])

  // когда новый экран проявился — убираем старый
  useEffect(() => {
    if (!st.prev) return
    const t = setTimeout(() => setSt((s) => (s.n === st.n ? { ...s, prev: null } : s)), OUT_MS)
    return () => clearTimeout(t)
  }, [st.n, st.prev])

  return (
    <>
      {st.prev && <div key={st.n - 1} className="pt pt-out" aria-hidden="true">{render(st.prev)}</div>}
      <div key={st.n} className={'pt pt-in' + (st.n && (entering || st.prev) ? ' pt-' + st.kind : '')} style={st.kind === 'tab' ? { ['--tx' as string]: st.ox + 'px', ['--ty' as string]: st.oy + 'px' } : undefined}>
        {render(loc)}
      </div>
    </>
  )
}
