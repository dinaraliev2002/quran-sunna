// Облачная проверка речи: запись → текст (Groq Whisper), спорные слова → решение ИИ (DeepSeek). Функция stt-check, см. bot/stt-check.
import { splitAudio } from './audioChunks'
import { tgInitData } from './telegram'

const ENDPOINT = 'https://ynqbnqkihojqlawhhiqg.supabase.co/functions/v1/stt-check'

/** Голос → текст */
export async function transcribe(blob: Blob, model = 'whisper-large-v3'): Promise<string> {
  const ext = blob.type.includes('wav') ? 'wav' : blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  const form = new FormData()
  form.append('audio', blob, `rec.${ext}`)
  form.append('model', model)
  form.append('init', tgInitData()) // подпись Telegram: по ней считаются лимиты
  const r = await fetch(ENDPOINT, { method: 'POST', body: form })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j.error || `Ошибка ${r.status}`), { limit: !!j.limit })
  return String(j.text ?? '')
}

/** Голос → текст; длинная запись — по частям, все части сразу (так Whisper не теряет куски) */
export async function transcribeLong(blob: Blob, model?: string): Promise<string> {
  const parts = await splitAudio(blob)
  const texts = await Promise.all(parts.map((p) => transcribe(p, model)))
  return texts.map((t) => t.trim()).filter(Boolean).join(' ')
}

export interface Flagged { i: number; w: string; said?: string }

/** ИИ: какие из спорных слов (по номеру) можно засчитать */
export async function judgeWords(ref: string, said: string, flagged: Flagged[], syn: boolean): Promise<number[]> {
  const r = await fetch(ENDPOINT, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'judge', ref, said, flagged, syn, init: tgInitData() }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Ошибка ${r.status}`)
  return Array.isArray(j.accept) ? j.accept : []
}
