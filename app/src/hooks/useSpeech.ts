import { useCallback, useEffect, useRef, useState } from 'react'

// Системное распознавание речи (Web Speech API): бесплатно, без своего сервера.
// Работает не везде: в Telegram на iPhone и в некоторых оболочках его нет — тогда supported = false.

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

/** Запись речи по-русски: text — всё распознанное за сеанс (с промежуточным хвостом) */
export function useSpeech(lang = 'ru-RU') {
  const supported = speechSupported()
  const [listening, setListening] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const rec = useRef<Rec | null>(null)
  const finals = useRef('')

  useEffect(() => () => rec.current?.stop(), [])

  const start = useCallback(() => {
    const C = Ctor()
    if (!C) return
    finals.current = ''
    setText('')
    setError('')
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
    r.onend = () => { setListening(false); if (finals.current.trim()) setText(finals.current.trim()) }
    rec.current = r
    try { r.start(); setListening(true) } catch { setError('Не удалось включить микрофон.') }
  }, [lang])

  const stop = useCallback(() => rec.current?.stop(), [])
  return { supported, listening, text, error, start, stop }
}
