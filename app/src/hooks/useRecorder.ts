import { useCallback, useEffect, useRef, useState } from 'react'
import { attachMeter } from '../lib/micMeter'
import { transcribe } from '../lib/voiceApi'
import { BARS } from './useSpeech'

export const recorderSupported = () =>
  typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

const pickMime = () => ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m))

/** Облачное распознавание: пишем голос, после «Закончить запись» отправляем на сервер (Groq Whisper) и получаем текст */
export function useRecorder() {
  const supported = recorderSupported()
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false) // запись ушла на распознавание
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0))
  const [metered, setMetered] = useState(false)
  const rec = useRef<MediaRecorder | null>(null)
  const stopMeter = useRef<(() => void) | null>(null)
  const stream = useRef<MediaStream | null>(null)

  const cleanup = useCallback(() => {
    stopMeter.current?.(); stopMeter.current = null
    stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null
  }, [])
  useEffect(() => () => { rec.current?.state === 'recording' && rec.current.stop(); cleanup() }, [cleanup])

  const start = useCallback(async (): Promise<boolean> => {
    setText(''); setError(''); setLevels(Array(BARS).fill(0))
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      stream.current = s
      try { stopMeter.current = attachMeter(s, (l) => setLevels((a) => [...a.slice(1), l])); setMetered(true) } catch { setMetered(false) }
      const mime = pickMime()
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined)
      const chunks: Blob[] = []
      r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      r.onstop = async () => {
        const type = r.mimeType || mime || 'audio/webm'
        cleanup()
        setListening(false)
        const blob = new Blob(chunks, { type })
        if (blob.size < 2000) { setError('Запись слишком короткая — попробуйте ещё раз.'); return }
        setBusy(true)
        try { setText(await transcribe(blob)) }
        catch (e) { setError('Облачное распознавание недоступно: ' + ((e as Error).message || 'нет связи') + '. Переключитесь на системное в настройках.') }
        finally { setBusy(false) }
      }
      rec.current = r
      r.start()
      setListening(true)
      return true
    } catch (e) {
      cleanup()
      const n = (e as DOMException)?.name
      setError(n === 'NotAllowedError' || n === 'SecurityError' ? 'Окно не даёт доступ к микрофону (' + n + ').' : n === 'NotFoundError' ? 'Микрофон не найден.' : 'Не удалось включить микрофон' + (n ? ' (' + n + ')' : '') + '.')
      return false
    }
  }, [cleanup])

  const stop = useCallback(() => { if (rec.current?.state === 'recording') rec.current.stop() }, [])
  return { supported, listening, busy, text, error, levels, metered, start, stop }
}
