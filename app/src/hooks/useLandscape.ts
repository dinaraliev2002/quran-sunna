import { useEffect, useState } from 'react'

/** Телефон повёрнут боком (низкий и широкий экран) */
export function useLandscape() {
  const q = () => window.innerWidth > window.innerHeight && window.innerHeight < 600
  const [v, setV] = useState(q)
  useEffect(() => {
    // при повороте размеры окна обновляются не сразу — перепроверяем ещё раз, когда всё уляжется
    let t: ReturnType<typeof setTimeout> | undefined
    const on = () => { setV(q()); clearTimeout(t); t = setTimeout(() => setV(q()), 350) }
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); clearTimeout(t) }
  }, [])
  return v
}
