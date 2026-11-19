import { useCallback, useEffect, useRef, useState } from 'react'
import { attachMeter } from '../lib/micMeter'
import { joinHeard, newRec, transcribe, transcribeLong, type Heard } from '../lib/voiceApi'
import { useVoiceAccess } from '../store/voiceAccess'
import { useStore } from '../store/settings'
import { setPlayback, setRecording } from '../lib/audioSession'
import { quietAudio } from '../lib/tickSound'
import { startWav } from '../lib/wavRecorder'
import { BARS } from './useSpeech'

export const recorderSupported = () =>
  typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

const pickMime = () => ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m))

/** Облачное распознавание: пишем голос, после «Закончить запись» отправляем на сервер (Groq Whisper) и получаем текст */
export function useRecorder(forced?: 'ru' | 'ar') {
  const supported = recorderSupported()
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false) // запись ушла на распознавание
  const [text, setText] = useState('')
  const [vowels, setVowels] = useState('') // тот же текст с огласовками (Gemini), если пришёл
  const [error, setError] = useState('')
  const [paywall, setPaywall] = useState(false) // сервер отказал: бесплатные проверки кончились, нужна подписка или пакет
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0))
  const [metered, setMetered] = useState(false)
  const ctl = useRef<{ stop: () => void } | null>(null)
  const stopMeter = useRef<(() => void) | null>(null)
  const stream = useRef<MediaStream | null>(null)

  const cleanup = useCallback(() => {
    stopMeter.current?.(); stopMeter.current = null
    stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null
    setPlayback()
  }, [])
  useEffect(() => () => { ctl.current?.stop(); cleanup() }, [cleanup])

  const lng = () => forced ?? useStore.getState().hzVoiceLang
  const model = () => (useStore.getState().hzVoiceModel === 'turbo' ? 'whisper-large-v3-turbo' : 'whisper-large-v3')
  const failText = (e: unknown) => ((e as Error & { paywall?: boolean }).paywall ? (e as Error).message : (e as Error & { limit?: boolean }).limit ? (e as Error).message + ' Можно переключиться на системное распознавание в настройках.' : 'Облачное распознавание недоступно: ' + ((e as Error).message || 'нет связи') + '. Переключитесь на системное в настройках.')

  /** Части записи распознаются по мере готовности; в конце ждём все и склеиваем по порядку */
  const finishParts = useCallback(async (parts: Promise<Heard>[]) => {
    cleanup()
    setListening(false)
    setBusy(true)
    try {
      const { text: t, vowels: v } = joinHeard(await Promise.all(parts))
      if (!t && !parts.length) setError('Запись слишком короткая — попробуйте ещё раз.')
      setText(t); setVowels(v)
      void useVoiceAccess.getState().load() // сколько проверок осталось
    } catch (e) { if ((e as Error & { paywall?: boolean }).paywall) setPaywall(true); setError(failText(e)); void useVoiceAccess.getState().load() }
    finally { setBusy(false) }
  }, [cleanup])

  /** Запасная запись WAV: целиком после остановки (длинную режем на части уже потом) */
  const finishWav = useCallback(async (blob: Blob) => {
    if (blob.size < 2000) { cleanup(); setListening(false); setError('Запись слишком короткая — попробуйте ещё раз.'); return }
    await finishParts([transcribeLong(blob, model(), lng())])
  }, [cleanup, finishParts])

  /**
   * Включить запись на потоке. Обычная (MediaRecorder) пишется частями ~20–28 с: новая часть начинается в паузе между словами,
   * готовая сразу уходит на распознавание (Whisper на цельной записи в пару минут выкидывает куски, по частям — нет).
   * Если MediaRecorder не запускается — своя запись WAV.
   */
  const begin = useCallback((s: MediaStream, mime: string | undefined): string => {
    try {
      const parts: Promise<Heard>[] = []
      const rec = newRec() // все части этой записи — одна проверка
      let cur: MediaRecorder | null = null
      let segStart = 0, quietSince = 0, stopping = false, closed = 0
      const opts = mime ? { mimeType: mime } : undefined
      const startPart = () => {
        const r = new MediaRecorder(s, opts)
        const chunks: Blob[] = []
        r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
        parts.push(new Promise<Heard>((res, rej) => {
          r.onstop = () => {
            const blob = new Blob(chunks, { type: r.mimeType || mime || 'audio/webm' })
            if (blob.size < 2000) res({ text: '', vowels: '' })
            else transcribe(blob, model(), lng(), rec).then(res, rej)
            closed++
            if (stopping && closed === parts.length) void finishParts(parts)
          }
        }))
        r.start()
        cur = r
        segStart = Date.now(); quietSince = 0
      }
      const rotate = () => { const old = cur; startPart(); if (old?.state === 'recording') old.stop() } // новая часть до остановки старой — без щели
      startPart()
      // где резать: после 20 с — в первой паузе (тихо 0,3 с), в любом случае — к 28 с
      const tick = (lvl: number) => {
        const now = Date.now(), t = now - segStart
        if (lvl < 0.08) quietSince = quietSince || now
        else quietSince = 0
        if (!stopping && ((t > 20000 && quietSince && now - quietSince > 300) || t > 28000)) rotate()
      }
      try { stopMeter.current = attachMeter(s, (l) => { setLevels((a) => [...a.slice(1), l]); tick(l) }); setMetered(true) }
      catch {
        setMetered(false)
        const id = window.setInterval(() => tick(1), 1000) // без громкости режем просто по времени
        stopMeter.current = () => clearInterval(id)
      }
      ctl.current = { stop: () => { stopping = true; if (cur?.state === 'recording') cur.stop() } }
      return 'media'
    } catch {
      const w = startWav(s, (l) => setLevels((a) => [...a.slice(1), l]))
      setMetered(true)
      ctl.current = { stop: () => { void w.stop().then(finishWav) } }
      return 'wav'
    }
  }, [finishParts, finishWav])

  const start = useCallback(async (): Promise<boolean> => {
    setText(''); setVowels(''); setError(''); setPaywall(false); setLevels(Array(BARS).fill(0))
    let fail: unknown, step = 'микрофон'
    quietAudio()
    document.querySelectorAll('audio').forEach((a) => a.pause())
    // 1) с шумоподавлением и нужным форматом; 2) если не вышло — самый простой вариант
    for (const simple of [false, true]) {
      try {
        step = 'микрофон'
        setRecording() // после неудачной попытки cleanup вернул «playback»
        const s = await navigator.mediaDevices.getUserMedia({ audio: simple ? true : { echoCancellation: true, noiseSuppression: true } })
        stream.current = s
        step = 'запись'
        begin(s, simple ? undefined : pickMime())
        setListening(true)
        return true
      } catch (e) { fail = e; cleanup() }
    }
    const n = (fail as DOMException)?.name
    setError(n === 'NotAllowedError' || n === 'SecurityError' ? 'Окно не даёт доступ к микрофону (' + n + ').' : n === 'NotFoundError' ? 'Микрофон не найден.' : 'Не удалось включить микрофон' + (n ? ' (' + n + ', шаг: ' + step + ((fail as Error)?.message ? ': ' + (fail as Error).message.slice(0, 80) : '') + ')' : '') + '.')
    return false
  }, [begin, cleanup])

  const stop = useCallback(() => { ctl.current?.stop(); ctl.current = null }, [])
  return { supported, listening, busy, text, vowels, error, paywall, levels, metered, start, stop }
}
