import { useCallback, useState } from 'react'
import { useStore } from '../store/settings'
import { useRecorder } from './useRecorder'
import { useSpeech } from './useSpeech'

/**
 * Запись голоса для проверки: облачная (Groq) или системная — по настройке; интерфейс у них общий.
 * Если в оболочке (например, Telegram на телефоне) облачной записи не дали микрофон,
 * а системное распознавание есть — на этот запуск переходим на системное, оно просит доступ по-своему.
 */
export function useVoice() {
  const setting = useStore((s) => s.hzVoiceEngine)
  const sys = useSpeech()
  const cloud = useRecorder()
  const [fallback, setFallback] = useState(false)
  const engine = setting === 'cloud' && !(fallback && sys.supported) ? 'cloud' : 'system'

  const cloudStart = cloud.start
  const sysStart = sys.start
  const start = useCallback(async () => {
    if (engine === 'system') return sysStart()
    const ok = await cloudStart()
    if (!ok && sys.supported) { setFallback(true); await sysStart() }
  }, [engine, cloudStart, sysStart, sys.supported])

  return engine === 'cloud' ? { ...cloud, start, engine } : { ...sys, busy: false, start, engine }
}
