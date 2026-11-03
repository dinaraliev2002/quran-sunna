import { useEffect } from 'react'

// каждая открытая страница засчитывается в «Сегодня» на главной и в серию дней
// страница засчитывается (и задание «Прочитать страницу» выполняется), когда на ней пробыли около минуты,
// а не при быстром заходе. Время в свёрнутом приложении не считаем.
export function usePageReadTimer(page: number, markPage: (p: number) => void) {
  useEffect(() => {
    let left = 60_000, since = Date.now(), t: ReturnType<typeof setTimeout> | undefined
    const run = () => { since = Date.now(); t = setTimeout(() => markPage(page), left) }
    const onVis = () => {
      if (document.hidden) { clearTimeout(t); left -= Date.now() - since } else run()
    }
    if (!document.hidden) run()
    document.addEventListener('visibilitychange', onVis)
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', onVis) }
  }, [page, markPage])
}
