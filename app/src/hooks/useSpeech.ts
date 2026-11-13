import { useCallback, useEffect, useRef, useState } from 'react'
import { attachMeter } from '../lib/micMeter'

// Системное распознавание речи (Web Speech API): бесплатно, без своего сервера.
// Работает не везде: в Telegram на iPhone и в некоторых оболочках его нет — тогда supported = false.
// Параллельно (если микрофон даётся) снимаем громкость — для полосок «идёт запись».

interface Rec {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

const Ctor = (): (new () => Rec) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const speechSupported = () => typeof window !== 'undefined' && !!Ctor()

const ERRORS: Record<string, string> = {
  'not-allowed': 'Нет доступа к микрофону — разрешите его в настройках.',
  'service-not-allowed': 'Распознавание речи выключено на устройстве.',
  'no-speech': 'Ничего не услышал — попробуйте ещё раз.',
  'audio-capture': 'Микрофон не найден.',
  network: 'Нет связи для распознавания речи.',
}

export const BARS = 28

/** Запись речи по-русски: text — распознанное (не показываем во время записи); levels — громкость для полосок */
export function useSpeech(lang = 'ru-RU') {
  const supported = speechSupported()
  const [listening, setListening] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0))
  const [metered, setMetered] = useState(false) // удалось ли снять громкость
  const rec = useRef<Rec | null>(null)
  const finals = useRef('')
  const meter = useRef<{ stop: () => void } | null>(null)
  const want = useRef(false) // человек ещё не нажал «закончить»: если распознавание само оборвалось на паузе — запускаем снова

  const stopMeter = useCallback(() => { meter.current?.stop(); meter.current = null }, [])
  useEffect(() => () => { want.current = false; rec.current?.stop(); stopMeter() }, [stopMeter])

  /** Громкость микрофона → полоски; если не вышло, остаются просто точки */
  const startMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const stopLevel = attachMeter(stream, (lvl) => setLevels((l) => [...l.slice(1), lvl]))
      setMetered(true)
      meter.current = { stop: () => { stopLevel(); stream.getTracks().forEach((t) => t.stop()) } }
    } catch { setMetered(false) }
  }, [])

  const start = useCallback(async () => {
    const C = Ctor()
    if (!C) return
    finals.current = ''
    want.current = true
    setText('')
    setError('')
    setLevels(Array(BARS).fill(0))
    await startMeter()
    const r = new C()
    r.lang = lang
    r.continuous = true
    r.interimResults = true
    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finals.current += res[0].transcript + ' '
        else interim += res[0].transcript
      }
      setText((finals.current + interim).trim())
    }
    r.onerror = (e) => { if (e.error !== 'aborted') setError(ERRORS[e.error] ?? 'Не удалось распознать речь.') }
    r.onend = () => {
      if (want.current) { try { r.start(); return } catch { /* не вышло — завершаем как обычно */ } }
      stopMeter(); setListening(false); if (finals.current.trim()) setText(finals.current.trim())
    }
    rec.current = r
    try { r.start(); setListening(true) } catch { stopMeter(); setError('Не удалось включить микрофон.') }
  }, [lang, startMeter, stopMeter])

  const stop = useCallback(() => { want.current = false; rec.current?.stop() }, [])
  return { supported, listening, text, error, levels, metered, start, stop }
}
