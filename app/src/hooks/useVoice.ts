import { useStore } from '../store/settings'
import type { VerifyItem } from '../lib/voiceApi'
import { useRecorder } from './useRecorder'
import { useSpeech } from './useSpeech'

/** Запись голоса для проверки: облачная (Groq) или системная — по настройке; интерфейс у них общий */
export function useVoice(forced?: 'ru' | 'ar') {
  const engine = useStore((s) => s.hzVoiceEngine)
  const lang = useStore((s) => forced ?? s.hzVoiceLang)
  const sys = useSpeech(lang === 'ar' ? 'ar-SA' : 'ru-RU')
  const cloud = useRecorder(forced)
  return engine === 'cloud' ? { ...cloud, engine } : { ...sys, busy: false, paywall: false, verify: null as VerifyItem[] | null, engine }
}
