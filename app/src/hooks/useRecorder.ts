import { useCallback, useEffect, useRef, useState } from 'react'
import { attachMeter } from '../lib/micMeter'
import { transcribe } from '../lib/voiceApi'
import { startWav } from '../lib/wavRecorder'
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
  const ctl = useRef<{ stop: () => void } | null>(null)
  const stopMeter = useRef<(() => void) | null>(null)
  const stream = useRef<MediaStream | null>(null)

  const cleanup = useCallback(() => {
    stopMeter.current?.(); stopMeter.current = null
    stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null
  }, [])
  useEffect(() => () => { ctl.current?.stop(); cleanup() }, [cleanup])

  /** Готовый звук ушёл на распознавание */
  const finish = useCallback(async (blob: Blob) => {
    cleanup()
    setListening(false)
    if (blob.size < 2000) { setError('Запись слишком короткая — попробуйте ещё раз.'); return }
    setBusy(true)
    try { setText(await transcribe(blob)) }
    catch (e) { setError('Облачное распознавание недоступно: ' + ((e as Error).message || 'нет связи') + '. Переключитесь на системное в настройках.') }
    finally { setBusy(false) }
  }, [cleanup])

  /** Включить запись на потоке: сначала обычная (MediaRecorder), если не вышла — своя запись WAV */
  const begin = useCallback((s: MediaStream, mime: string | undefined): string => {
    try {
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined)
      const chunks: Blob[] = []
      r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      r.onstop = () => { void finish(new Blob(chunks, { type: r.mimeType || mime || 'audio/webm' })) }
      r.start()
      ctl.current = { stop: () => { if (r.state === 'recording') r.stop() } }
      try { stopMeter.current = attachMeter(s, (l) => setLevels((a) => [...a.slice(1), l])); setMetered(true) } catch { setMetered(false) }
      return 'media'
    } catch {
      const w = startWav(s, (l) => setLevels((a) => [...a.slice(1), l]))
      setMetered(true)
      ctl.current = { stop: () => { void w.stop().then(finish) } }
      return 'wav'
    }
  }, [finish])

  const start = useCallback(async (): Promise<boolean> => {
    setText(''); setError(''); setLevels(Array(BARS).fill(0))
    let fail: unknown, step = 'микрофон'
    // 1) с шумоподавлением и нужным форматом; 2) если не вышло — самый простой вариант
    for (const simple of [false, true]) {
      try {
        step = 'микрофон'
        const s = await navigator.mediaDevices.getUserMedia({ audio: simple ? true : { echoCancellation: true, noiseSuppression: true } })
        stream.current = s
        step = 'запись'
        begin(s, simple ? undefined : pickMime())
        setListening(true)
        return true
      } catch (e) { fail = e; cleanup() }
    }
    const n = (fail as DOMException)?.name
    setError(n === 'NotAllowedError' || n === 'SecurityError' ? 'Окно не даёт доступ к микрофону (' + n + ').' : n === 'NotFoundError' ? 'Микрофон не найден.' : 'Не удалось включить микрофон' + (n ? ' (' + n + ', шаг: ' + step + ')' : '') + '.')
    return false
  }, [begin, cleanup])

  const stop = useCallback(() => { ctl.current?.stop(); ctl.current = null }, [])
  return { supported, listening, busy, text, error, levels, metered, start, stop }
}
