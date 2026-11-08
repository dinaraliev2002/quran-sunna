// Запуск аудио суры из любого места приложения (главная, список сур): чтец и настройки плеера — из настроек
import { useStore } from '../store/settings'
import { playerCfg, setMediaTitle, setReciter, usePlayer } from '../store/player'
import type { Surah } from './data'

let counts: number[] = []

/** С какого аята начинать суру: с места остановки (если включено) или с первого */
export function resumeAyah(sid: number, ayahs: number) {
  const st = useStore.getState()
  const a = st.plResume ? st.plPos[sid] : 0
  return a && a > 1 && a < ayahs ? a : 1
}

/** Сколько аятов в сурах — нужно, чтобы плеер сам переходил к следующей суре */
export const setSurahCounts = (surahs: Surah[]) => { counts = surahs.map((s) => s.ayahs) }

export function listenSurah(surahs: Surah[], sid: number, from?: number) {
  const sr = surahs[sid - 1]
  if (!sr) return
  counts = surahs.map((s) => s.ayahs)
  const st = useStore.getState()
  setReciter(st.reciter)
  setMediaTitle((k) => { const [a, b] = k.split(':'); return `${surahs[+a - 1].name}, аят ${b}` })
  const f = from ?? resumeAyah(sid, sr.ayahs)
  usePlayer.getState().play(Array.from({ length: sr.ayahs - f + 1 }, (_, i) => `${sid}:${f + i}`), 0)
}

/** Подключить настройки плеера и запоминание места остановки (вызывается один раз при старте) */
export function initPlayerSettings() {
  const apply = () => {
    const s = useStore.getState()
    playerCfg.gap = s.plGap
    playerCfg.next = s.plNext
    playerCfg.rate = s.plRate
  }
  apply()
  playerCfg.surahCount = (n) => counts[n - 1] ?? 0
  useStore.subscribe(apply)
  // место остановки: запоминаем, когда плеер встал на паузу или закончил (не на каждом аяте — облако не любит частые записи)
  let last: string | null = null
  usePlayer.subscribe((p) => {
    if (p.current) last = p.current
    if (p.memo || !last) return
    if (p.status === 'paused' || p.status === 'idle') {
      const [s, a] = last.split(':').map(Number)
      const st = useStore.getState()
      if (!st.plResume) return
      const total = counts[s - 1]
      const next = total && a >= total ? 0 : a // дослушали до конца — в следующий раз сначала
      if ((st.plPos[s] ?? 0) !== next) st.set({ plPos: { ...st.plPos, [s]: next } })
      last = p.status === 'idle' ? null : last
    }
  })
}
