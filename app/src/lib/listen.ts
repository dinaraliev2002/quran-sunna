// Запуск аудио суры из любого места приложения (главная, список сур): чтец и качество — из настроек
import { useStore } from '../store/settings'
import { setBitrates, setMediaTitle, setReciter, usePlayer } from '../store/player'
import type { Surah } from './data'

export function listenSurah(surahs: Surah[], sid: number, from = 1) {
  const sr = surahs[sid - 1]
  if (!sr) return
  const st = useStore.getState()
  setBitrates(st.bitrates)
  setReciter(st.reciter)
  setMediaTitle((k) => { const [a, b] = k.split(':'); return `${surahs[+a - 1].name}, аят ${b}` })
  usePlayer.getState().play(Array.from({ length: sr.ayahs - from + 1 }, (_, i) => `${sid}:${from + i}`), 0)
}
