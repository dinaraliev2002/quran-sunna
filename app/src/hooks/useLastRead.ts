import { useCallback, useEffect, useRef } from 'react'
import { useStore } from '../store/settings'

// ----- последнее место чтения -----
// открыли по ссылке (из азкаров, 99 имён, «Аят дня») — это не «своё» чтение: «Продолжить чтение» не трогаем,
// пока человек сам не перейдёт к другой суре или странице через выбор суры/колесо (тогда fromLink.current = false)
export function useLastRead(openedByLink: boolean) {
  const fromLink = useRef(openedByLink)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pendingLast = useRef<{ s: number; a: number; p: number } | null>(null)
  // записать сразу — при выходе из чтения и при сворачивании, чтобы не потерять последние 0,8 с
  const flushLast = useCallback(() => {
    clearTimeout(saveTimer.current)
    const x = pendingLast.current
    pendingLast.current = null
    if (x && !fromLink.current) useStore.getState().setLastRead(x)
  }, [])
  const saveLast = useCallback((s: number, a: number, p: number) => {
    clearTimeout(saveTimer.current)
    if (fromLink.current) return
    pendingLast.current = { s, a, p }
    saveTimer.current = setTimeout(flushLast, 800)
  }, [flushLast])
  useEffect(() => {
    const onHide = () => { if (document.hidden) flushLast() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flushLast)
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flushLast); flushLast() }
  }, [flushLast])
  return { saveLast, fromLink }
}
