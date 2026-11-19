// Облачная проверка речи: запись → текст (Groq Whisper), спорные слова → решение ИИ (DeepSeek). Функция stt-check, см. bot/stt-check.
import { splitAudio } from './audioChunks'
import { tgInitData } from './telegram'
import { getVoiceContext } from './voiceContext'
import { useStore } from '../store/settings'

const ENDPOINT = 'https://ynqbnqkihojqlawhhiqg.supabase.co/functions/v1/stt-check'

/** Голос → текст */
/** rec — номер записи: у длинной записи несколько частей, а проверка считается одна */
/** Замечание Gemini к слову эталона (по-арабски): i — номер слова (с 1), s — что не так: другая гласная, другая буква, пропуск; h — что услышал */
export interface VerifyItem { i: number; s: 'vowel' | 'letter' | 'missing'; h?: string }
/** Что услышали: text — слова (Groq), verify — замечания Gemini по гласным и буквам (только по-арабски, может быть пустым) */
export interface Heard { text: string; verify: VerifyItem[] }
export async function transcribe(blob: Blob, model = 'whisper-large-v3', lang: 'ru' | 'ar' = 'ru', rec = ''): Promise<Heard> {
  const ext = blob.type.includes('wav') ? 'wav' : blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  const form = new FormData()
  form.append('audio', blob, `rec.${ext}`)
  form.append('model', model)
  form.append('lang', lang)
  if (rec) form.append('rec', rec)
  const c = getVoiceContext()
  if (lang === 'ar' && c.ref) form.append('ref', c.ref) // эталон: по нему Gemini проверяет гласные и буквы каждого слова
  if (useStore.getState().hzVoiceSave) { // человек разрешил сохранять записи для разработчика
    form.append('save', '1'); form.append('label', c.label)
    if (lang !== 'ar') form.append('ref', c.ref)
  }
  form.append('init', tgInitData()) // подпись Telegram: по ней считаются лимиты
  const r = await fetch(ENDPOINT, { method: 'POST', body: form })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j.error || `Ошибка ${r.status}`), { limit: !!j.limit, paywall: !!j.paywall })
  return { text: String(j.text ?? ''), verify: Array.isArray(j.verify) ? (j.verify as VerifyItem[]) : [] }
}

/** Голос → текст; длинная запись — по частям, все части сразу (так Whisper не теряет куски) */
export async function transcribeLong(blob: Blob, model?: string, lang: 'ru' | 'ar' = 'ru', rec = newRec()): Promise<Heard> {
  const parts = await splitAudio(blob)
  const heard = await Promise.all(parts.map((p) => transcribe(p, model, lang, rec)))
  return joinHeard(heard)
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

/** Склеить распознанные части записи по порядку */
export const joinHeard = (h: Heard[]): Heard => {
  // у каждого слова берём первое замечание; «гласная/буква» важнее «пропущено»
  const by = new Map<number, VerifyItem>()
  for (const x of h) for (const v of x.verify) { const c = by.get(v.i); if (!c || (c.s === 'missing' && v.s !== 'missing')) by.set(v.i, v) }
  return { text: h.map((x) => x.text.trim()).filter(Boolean).join(' '), verify: [...by.values()].sort((a, b) => a.i - b.i) }
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
