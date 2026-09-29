import { create } from 'zustand'
import { usePlayer } from './player'

// Простой плеер для азкаров (аудио hisnmuslim.com). Один звук за раз.
const audio = new Audio()
audio.preload = 'none'

interface State {
  id: number | null
  status: 'idle' | 'loading' | 'playing' | 'error'
  toggle: (id: number, url: string) => void
  stop: () => void
}

export const useAzkarAudio = create<State>((set, get) => {
  audio.onplaying = () => set({ status: 'playing' })
  audio.onended = () => set({ id: null, status: 'idle' })
  audio.onerror = () => { if (get().id !== null) set({ status: 'error' }) }
  audio.onpause = () => { if (get().status === 'playing' && !audio.ended) set({ id: null, status: 'idle' }) }
  window.addEventListener('quran-play', () => { if (get().id !== null) { audio.pause(); set({ id: null, status: 'idle' }) } })

  return {
    id: null,
    status: 'idle',
    toggle: (id, url) => {
      if (get().id === id) { audio.pause(); set({ id: null, status: 'idle' }); return }
      usePlayer.getState().stop() // чтец Корана и азкары не звучат одновременно
      set({ id, status: 'loading' })
      audio.src = url
      audio.play().catch(() => set({ status: 'error' }))
    },
    stop: () => { audio.pause(); set({ id: null, status: 'idle' }) },
  }
})
