// Облачная проверка речи: запись → текст (Groq Whisper), спорные слова → решение ИИ (DeepSeek). Функция stt-check, см. bot/stt-check.
import { splitAudio } from './audioChunks'
import { tgInitData } from './telegram'

const ENDPOINT = 'https://ynqbnqkihojqlawhhiqg.supabase.co/functions/v1/stt-check'

/** Голос → текст */
/** rec — номер записи: у длинной записи несколько частей, а проверка считается одна */
export async function transcribe(blob: Blob, model = 'whisper-large-v3', lang: 'ru' | 'ar' = 'ru', rec = ''): Promise<string> {
  const ext = blob.type.includes('wav') ? 'wav' : blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  const form = new FormData()
  form.append('audio', blob, `rec.${ext}`)
  form.append('model', model)
  form.append('lang', lang)
  if (rec) form.append('rec', rec)
  form.append('init', tgInitData()) // подпись Telegram: по ней считаются лимиты
  const r = await fetch(ENDPOINT, { method: 'POST', body: form })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j.error || `Ошибка ${r.status}`), { limit: !!j.limit, paywall: !!j.paywall })
  return String(j.text ?? '')
}

/** Голос → текст; длинная запись — по частям, все части сразу (так Whisper не теряет куски) */
export async function transcribeLong(blob: Blob, model?: string, lang: 'ru' | 'ar' = 'ru', rec = newRec()): Promise<string> {
  const parts = await splitAudio(blob)
  const texts = await Promise.all(parts.map((p) => transcribe(p, model, lang, rec)))
  return texts.map((t) => t.trim()).filter(Boolean).join(' ')
}

/** Ссылка на счёт в звёздах Telegram за тариф (только внутри Telegram: сервер проверяет подпись) */
export async function createInvoice(plan: string): Promise<string> {
  const r = await fetch('https://ynqbnqkihojqlawhhiqg.supabase.co/functions/v1/quran-bot', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'invoice', plan, initData: tgInitData() }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.url) throw new Error(j.error || `Ошибка ${r.status}`)
  return String(j.url)
}

/** Номер новой записи */
export const newRec = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))

/** Что осталось у человека: бесплатные проверки, пакет, подписка (paywall=false — платный доступ ещё не включён) */
export interface VoiceAccessInfo { paywall: boolean; can: boolean; free_left?: number; credits?: number; sub_until?: string | null; vip?: boolean; day_left?: number }
export async function fetchAccess(): Promise<VoiceAccessInfo> {
  const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'access', init: tgInitData() }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Ошибка ${r.status}`)
  return j
}

export interface Flagged { i: number; w: string; said?: string }

/** ИИ: какие из спорных слов (по номеру) можно засчитать */
export async function judgeWords(ref: string, said: string, flagged: Flagged[], syn: boolean, lang: 'ru' | 'ar' = 'ru'): Promise<number[]> {
  const r = await fetch(ENDPOINT, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'judge', ref, said, flagged, syn, lang, init: tgInitData() }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Ошибка ${r.status}`)
  return Array.isArray(j.accept) ? j.accept : []
}
