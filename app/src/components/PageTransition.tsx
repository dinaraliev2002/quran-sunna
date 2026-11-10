import { useEffect, type ReactNode } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import './PageTransition.css'

// Плавный переход между экранами. Новый экран проявляется и слегка выезжает; с нижней панели — «вылетает» из нажатой кнопки;
// назад — мягкое проявление с лёгким приближением. Страницы Корана внутри одной суры (/read/…) не анимируются — там своё листание.

/** Откуда нажали: центр кнопки нижней панели и время нажатия (переход, начатый в ближайшие 700 мс, считаем «из кнопки») */
const tap = { x: 0, y: 0, t: 0 }

export function PageTransition({ children }: { children: ReactNode }) {
  const loc = useLocation()
  const type = useNavigationType()

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

  const key = loc.pathname.startsWith('/read/') ? '/read' : loc.pathname
  const fromTab = type !== 'POP' && Date.now() - tap.t < 700
  const kind = type === 'POP' ? 'back' : fromTab ? 'tab' : 'push'
  return (
    <div key={key} className={'pt pt-' + kind} style={kind === 'tab' ? { ['--tx' as string]: tap.x + 'px', ['--ty' as string]: tap.y + 'px' } : undefined}>
      {children}
    </div>
  )
}
