// Доступ к проверке голосом: сколько бесплатных проверок осталось, есть ли пакет или подписка. Данные берутся с сервера (stt-check).
import { create } from 'zustand'
import { fetchAccess, type VoiceAccessInfo } from '../lib/voiceApi'

interface VoiceAccessState {
  /** ответ сервера получен */
  loaded: boolean
  info: VoiceAccessInfo
  load: () => Promise<void>
}

export const useVoiceAccess = create<VoiceAccessState>((set) => ({
  loaded: false,
  info: { paywall: false, can: true },
  load: async () => {
    try { set({ info: await fetchAccess(), loaded: true }) } catch { /* нет связи — оставляем как было */ }
  },
}))

/** Закрыта ли проверка голосом: платный доступ включён и права нет */
export const isVoiceLocked = (a: VoiceAccessState) => a.loaded && a.info.paywall && !a.info.can
