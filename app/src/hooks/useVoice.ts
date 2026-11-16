import { useStore } from '../store/settings'
import { useRecorder } from './useRecorder'
import { useSpeech } from './useSpeech'

/** Запись голоса для проверки: облачная (Groq) или системная — по настройке; интерфейс у них общий */
export function useVoice() {
  const engine = useStore((s) => s.hzVoiceEngine)
  const lang = useStore((s) => s.hzVoiceLang)
  const sys = useSpeech(lang === 'ar' ? 'ar-SA' : 'ru-RU')
  const cloud = useRecorder()
  return engine === 'cloud' ? { ...cloud, engine } : { ...sys, busy: false, engine }
}
