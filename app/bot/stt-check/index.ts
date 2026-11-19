// Проверка речи при заучивании (Supabase Edge Function «stt-check»).
//  1) Голос → текст: Groq (Whisper large-v3 или turbo). Приложение присылает запись (multipart: audio, model, lang, init).
//  2) Решение «ошибка или нет»: DeepSeek смотрит на слова, которые алгоритм счёл ошибками, и говорит, какие из них можно
//     засчитать (перестановка «посланнику Его» / «Его посланнику», ошибка распознавания, при желании — близкий синоним).
//  Арабский (lang=ar) может распознавать Gemini — он пишет с огласовками и не исправляет ошибки. Включается секретом VOICE_AR_ENGINE=gemini
//  (нужен GEMINI_API_KEY); при сбое Gemini запись уходит в Groq.
//  Платный доступ (VOICE_PAYWALL=1): 5 бесплатных проверок, затем пакет или подписка (таблицы qs_voice_access / qs_voice_rec, функции qs_voice_*).
//  Проверка = одна запись (номер rec; у длинной записи несколько частей — списывается один раз). Не распознали — проверка возвращается.
// Секреты (Edge Functions → Secrets): GROQ_API_KEY_APK, DEEPSEEK_API_KEY_APK (подходят и GROQ_API_KEY / DEEPSEEK_API_KEY). Verify JWT — выключить, как у остальных функций.
// Защита от чужих запросов и перерасхода (таблица qs_voice_usage, функция qs_voice_add):
//  • из Telegram приложение присылает initData — подпись проверяется ключом бота (BOT_TOKEN, тот же, что у quran-bot);
//  • без Telegram (браузер) — учёт по адресу (хеш IP), лимит меньше;
//  • лимиты в секундах речи в день: на человека и на всех вместе; у ИИ-помощника — число запросов в день.
//    Меняются секретами VOICE_TG_SEC, VOICE_WEB_SEC, VOICE_ALL_SEC, VOICE_JUDGE (по умолчанию — ниже).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'

// ключ берём первый подходящий: только печатные ASCII-символы (случайно вставленная заглушка вроде «ВАШ_КЛЮЧ» не годится)
const pick = (...names: string[]) => names.map((n) => (Deno.env.get(n) ?? '').trim()).find((v) => /^[!-~]{10,}$/.test(v)) ?? ''
const GROQ = pick('GROQ_API_KEY_APK', 'GROQ_API_KEY')
const DEEPSEEK = pick('DEEPSEEK_API_KEY_APK', 'DEEPSEEK_API_KEY')
const GEMINI = pick('GEMINI_API_KEY')
const TOKEN = Deno.env.get('BOT_TOKEN') ?? ''
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const num = (n: string, d: number) => Number(Deno.env.get(n) ?? '') || d
// Платный доступ: включается секретом VOICE_PAYWALL=1. Бесплатных проверок на человека — VOICE_FREE, по подписке в день — VOICE_SUB_DAY.
const PAYWALL = (Deno.env.get('VOICE_PAYWALL') ?? '').trim() === '1'
const FREE = num('VOICE_FREE', 5)
// Сохранение записей для разработчика (проверка качества): секрет VOICE_SAVE=1 разрешает, и только если человек сам включил «Сохранять мои записи» в настройках
const SAVE = (Deno.env.get('VOICE_SAVE') ?? '').trim() === '1'
const SUB_DAY = num('VOICE_SUB_DAY', 20)
const LIMIT = { tg: num('VOICE_TG_SEC', 30 * 60), web: num('VOICE_WEB_SEC', 10 * 60), all: num('VOICE_ALL_SEC', 5 * 3600), judge: num('VOICE_JUDGE', 300) }
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' }
const MAX_AUDIO = 12 * 1024 * 1024 // ~12 МБ: хватает на несколько минут речи

// deno-lint-ignore no-explicit-any
type Any = any
const json = (body: Any, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

const enc = new TextEncoder()
const hmac = async (key: Uint8Array | string, msg: string) => {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? enc.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)))
}
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')

/** Подпись Telegram верна — возвращаем id пользователя (сессия мини-приложения может жить долго, берём неделю) */
async function tgUser(raw: string): Promise<number | null> {
  if (!raw || !TOKEN) return null
  const p = new URLSearchParams(raw)
  const hash = p.get('hash'); p.delete('hash')
  if (!hash) return null
  const str = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n')
  if (hex(await hmac(await hmac('WebAppData', TOKEN), str)) !== hash) return null
  if (Date.now() / 1000 - Number(p.get('auth_date') ?? 0) > 7 * 86400) return null
  try { return Number(JSON.parse(p.get('user') ?? 'null')?.id) || null } catch { return null }
}

interface Who { key: string; tg: boolean }
async function who(req: Request, init: string): Promise<Who> {
  const id = await tgUser(init)
  if (id) return { key: 'tg:' + id, tg: true }
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'none'
  return { key: 'ip:' + hex(await hmac('stt-check', ip)).slice(0, 16), tg: false }
}

const today = () => new Date().toISOString().slice(0, 10)
async function used(key: string) {
  const { data } = await db.from('qs_voice_usage').select('audio_sec, judge').eq('key', key).eq('day', today()).maybeSingle()
  return { sec: Number(data?.audio_sec ?? 0), judge: Number(data?.judge ?? 0) }
}
const add = (key: string, s: number, c: number, j: number) => db.rpc('qs_voice_add', { k: key, d: today(), s, c, j })

class Limit extends Error {}
class Paywall extends Error { constructor(m: string, public daycap = false) { super(m) } }

/** Списать одну проверку за запись rec (все части одной записи — одна проверка). Нет права — Paywall */
async function take(w: Who, rec: string) {
  if (!PAYWALL) return
  const { data, error } = await db.rpc('qs_voice_take', { k: w.key, r: rec, free_n: FREE, day_cap: SUB_DAY })
  if (error) throw new Error('не удалось проверить доступ')
  if (!data?.ok) throw new Paywall(data?.daycap ? 'На сегодня проверки по подписке закончились — продолжим завтра.' : 'Бесплатные проверки закончились. Оформите подписку или пакет проверок.', !!data?.daycap)
}
const refund = (w: Who, rec: string) => (PAYWALL ? db.rpc('qs_voice_refund', { k: w.key, r: rec }) : Promise.resolve())

/** Что у человека осталось: бесплатные, пакет, подписка */
async function access(w: Who) {
  if (!PAYWALL) return { paywall: false, can: true }
  const { data } = await db.rpc('qs_voice_status', { k: w.key, free_n: FREE, day_cap: SUB_DAY })
  const a = data ?? { free_left: FREE, credits: 0, sub_until: null, vip: false, day_left: 0 }
  return { paywall: true, ...a, can: !!(a.vip || a.free_left > 0 || a.credits > 0 || a.day_left > 0) }
}
/** Хватает ли лимита на распознавание */
async function canListen(w: Who) {
  const [me, all] = await Promise.all([used(w.key), used('*')])
  if (all.sec >= LIMIT.all) throw new Limit('Сегодня проверка голосом перегружена — попробуйте завтра.')
  if (me.sec >= (w.tg ? LIMIT.tg : LIMIT.web)) throw new Limit(w.tg ? 'Дневной лимит проверок голосом исчерпан — продолжим завтра.' : 'Дневной лимит проверок в браузере исчерпан. В приложении в Telegram лимит больше.')
}

/** Гласные и буквы по-арабски проверяет Gemini («сверка по слову»), если включён секретом VOICE_AR_ENGINE=gemini (иначе только Groq: слова без огласовок). Модель — секрет GEMINI_MODEL. */
const GEM_MODEL = Deno.env.get('GEMINI_MODEL')?.trim() || 'gemini-3.8-flash'
const GEM_THINK = Deno.env.get('VOICE_GEM_THINK')?.trim() || 'low' // уровень «размышлений»: low — без трат (при стандартных размышлениях проверка в 9 раз дороже и втрое медленнее, точность та же)
const AR_GEMINI = (Deno.env.get('VOICE_AR_ENGINE') ?? '').trim() === 'gemini' && !!GEMINI
const VERIFY_PROMPT = [
  'You are a strict Arabic recitation verifier. A student recites from memory. Below is the REFERENCE text the student should say, as numbered words, with full diacritics. The audio may contain only a PART of the reference.',
  'Listen to the audio and compare it to the reference WORD BY WORD, judging only the actual sounds you hear. Do NOT assume the student said the reference: students make mistakes on purpose, so assume NOTHING and check each word. Famous verses and hadiths are often misrecited - do not use your memory of the text, use only the audio.',
  'Report ONLY the words that are NOT pronounced exactly as written, with one status each:',
  '"vowel" - same consonants but a short vowel is different (a/u/i swapped, or doubling/shadda missing or added); put the vowel you heard in "heard";',
  '"letter" - a consonant is different or a different letter is pronounced; put what you heard in "heard";',
  '"missing" - a word inside the part that the student recites was skipped (do NOT report words that are outside the recited part).',
  'Words that are pronounced correctly are NOT listed. Ignore the vowel of the first letter of words starting with alif-wasl.',
  'Word endings: the student may DROP the final vowel when pausing (sukun at a stop) - that is NOT an error. But a DIFFERENT final vowel IS an error ("vowel"): for example -a or -o or -i instead of -u (al-ardu said as al-arda / al-ardo), -i instead of -a, or a missing/added tanween when the student does not pause.',
  'Answer ONLY with JSON: [{"i":2,"status":"vowel","heard":"..."}] - or [] if everything is correct.',
  'REFERENCE:',
].join('\n')

interface VerifyItem { i: number; s: 'vowel' | 'letter' | 'missing'; h?: string }

/** Сверка по слову: Gemini слушает запись, видя эталон, и называет слова, произнесённые иначе (гласная, буква, пропуск).
 *  Свободная расшифровка тут не годится: модель «исправляет» ошибку на знакомый текст; когда спрашиваешь про каждое слово отдельно — ловит гораздо больше. */
async function verifyGemini(file: File, ref: string) {
  const toks = ref.split(/\s+/).filter(Boolean)
  const prompt = VERIFY_PROMPT + '\n' + toks.map((t, k) => `${k + 1}. ${t.replace(/[﴿﴾]/g, '')}`).join('\n')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mime = (file.type || 'audio/wav').split(';')[0]
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEM_MODEL}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: encodeBase64(bytes) } }] }],
      generationConfig: { temperature: 0, ...(GEM_THINK ? { thinkingConfig: { thinkingLevel: GEM_THINK } } : {}) },
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  const raw = (j.candidates?.[0]?.content?.parts ?? []).map((p: Any) => p.text ?? '').join('')
  const m = raw.match(/\[[\s\S]*\]/)
  if (!m) throw new Error('Gemini: ответ не по форме')
  const items: VerifyItem[] = []
  for (const x of JSON.parse(m[0]) as Any[]) {
    const i = Number(x?.i), st = String(x?.status ?? '')
    if (Number.isInteger(i) && i >= 1 && i <= toks.length && (st === 'vowel' || st === 'letter' || st === 'missing')) items.push({ i, s: st, ...(x.heard ? { h: String(x.heard).slice(0, 40) } : {}) })
  }
  // длительность: у WAV 16 кГц моно — 32 000 байт в секунду, у сжатых форматов грубо 6 000
  return { items, sec: /wav/i.test(mime) ? Math.max(1, (bytes.length - 44) / 32000) : bytes.length / 6000 }
}

/** Голос → текст через Groq (Whisper; без подсказки — с ней он повторял её вместо речи) */
async function transcribeGroq(file: File, form: FormData) {
  if (!GROQ) throw new Error('нет GROQ_API_KEY')
  const out = new FormData()
  out.append('file', file, file.name || 'rec.webm')
  // модель: turbo (быстрее, дешевле) или полная large-v3 (точнее); выбирает приложение
  const model = String(form.get('model') ?? '') === 'whisper-large-v3' ? 'whisper-large-v3' : 'whisper-large-v3-turbo'
  out.append('model', model)
  out.append('language', String(form.get('lang') ?? '') === 'ar' ? 'ar' : 'ru') // ar — арабский (хадисы, Коран)
  out.append('response_format', 'verbose_json') // с длительностью и уверенностью по кускам
  out.append('temperature', '0')
  // подсказку не даём: Whisper начинал повторять её вместо речи и выкидывал куски длинных записей
  if (String(form.get('prompt') ?? '') === '1') out.append('prompt', 'Хадис Пророка Мухаммада. Посланник Аллаха сказал.')
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${GROQ}` }, body: out })
  if (!r.ok) throw new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  const sec = Number(j.duration) || file.size / 6000 // если длительности нет — грубо по размеру
  // куски, где модели почти уверена, что речи нет, — это её «додумки» в тишине («شكرا», «موسيقى», «Продолжение следует…»)
  const segs: Any[] = Array.isArray(j.segments) ? j.segments : []
  const text = segs.length ? segs.filter((g) => !(Number(g.no_speech_prob) > 0.8)).map((g) => String(g.text ?? '')).join('') : String(j.text ?? '')
  // Whisper на тишине и шуме «додумывает» одну-две фразы («موسيقى» — музыка, «شكرا» — спасибо, «اشتركوا في القناة»): такой ответ — не речь
  const t = text.trim()
  const junk = /^[\s.،!]*(موسيقى|شكرا|شكرا لكم|شكراً|اشتركوا في القناة|ترجمة نانسي قنقر|تمت الترجمة)[\s.،!]*$/.test(t)
  return { text: junk ? '' : t, sec }
}

/** Голос → текст. По-арабски (если подключён Gemini и приложение прислало эталон ref) слушают обе модели: Groq — слова и пропуски,
 *  Gemini — «сверка по слову» (гласные и буквы; обычная расшифровка Gemini «исправляет» ошибки на знакомый текст). Ответ: text (Groq) и verify (замечания Gemini). */
async function transcribe(form: FormData, w: Who) {
  await canListen(w)
  const file = form.get('audio')
  if (!(file instanceof File)) throw new Error('нет записи')
  if (file.size > MAX_AUDIO) throw new Error('запись слишком длинная')
  const count = (sec: number) => Promise.all([add(w.key, sec, 1, 0), add('*', sec, 1, 0)])
  const ref = String(form.get('ref') ?? '').slice(0, 8000)
  if (AR_GEMINI && String(form.get('lang') ?? '') === 'ar' && ref.trim()) {
    const [q, g] = await Promise.allSettled([transcribeGroq(file, form), verifyGemini(file, ref)])
    if (g.status === 'rejected') console.error('gemini:', String((g.reason as Error)?.message ?? g.reason))
    if (q.status === 'fulfilled') {
      await count(q.value.sec)
      return { text: q.value.text, ...(g.status === 'fulfilled' ? { verify: g.value.items } : {}), engine: g.status === 'fulfilled' ? 'groq+gemini' : 'groq' }
    }
    if (g.status === 'fulfilled') { await count(g.value.sec); return { text: '', verify: g.value.items, engine: 'gemini' } } // Groq не ответил — остаётся сверка Gemini
    throw q.reason
  }
  const r = await transcribeGroq(file, form)
  await count(r.sec)
  return { text: r.text, engine: 'groq' }
}

/** Сохранить запись и что по ней распознали (файл — в хранилище voice-samples, строка — в qs_voice_samples). Ошибки сохранения человеку не показываем */
async function saveSample(w: Who, form: FormData, res: Any) {
  try {
    const file = form.get('audio')
    if (!(file instanceof File)) return
    const id = crypto.randomUUID()
    const ext = file.type.includes('wav') ? 'wav' : file.type.includes('mp4') ? 'm4a' : file.type.includes('ogg') ? 'ogg' : 'webm'
    const path = `${w.key.replace(/[^a-z0-9]/gi, '_')}/${today()}/${id}.${ext}`
    const up = await db.storage.from('voice-samples').upload(path, file, { contentType: file.type || 'audio/webm' })
    if (up.error) throw up.error
    await db.from('qs_voice_samples').insert({
      id, key: w.key, rec: String(form.get('rec') ?? '').slice(0, 64), path, lang: String(form.get('lang') ?? ''),
      label: String(form.get('label') ?? '').slice(0, 200), ref: String(form.get('ref') ?? '').slice(0, 8000),
      engine: res.engine ?? null, text: res.text ?? null, vowels: res.verify ? JSON.stringify(res.verify) : null,
    })
  } catch (e) { console.error('save sample', e) }
}
/** Доделать работу в фоне, не задерживая ответ человеку */
const background = (p: Promise<unknown>) => { const rt = (globalThis as Any).EdgeRuntime; if (rt?.waitUntil) rt.waitUntil(p); else void p }

/** Какие спорные слова эталона можно засчитать */
async function judge(b: Any, w: Who) {
  const flagged: { i: number; w: string; said?: string }[] = Array.isArray(b.flagged) ? b.flagged.slice(0, 80) : []
  if (!DEEPSEEK || !flagged.length) return { accept: [] as number[] }
  if ((await used(w.key)).judge >= LIMIT.judge) return { accept: [] as number[], limit: true } // без ИИ — обычная сверка
  await add(w.key, 0, 0, 1)
  const syn = !!b.syn
  const ar = b.lang === 'ar'
  const system = ar ? [
    'Ты помогаешь проверять заучивание арабского текста хадиса. Человек прочитал его вслух по памяти, речь распознана автоматически (Whisper) и записана без огласовок; в ней бывают ошибки распознавания.',
    'Дан эталонный текст, распознанная речь и список слов эталона, которые алгоритм счёл ошибкой или пропуском (i — идентификатор слова, w — слово эталона, said — что алгоритм сопоставил). Огласовки (харакаты, шадда, сукун) НЕ проверяются — сравнивай только буквы. Для каждого слова реши: сказано ли оно в распознанной речи (в любом месте).',
    'Засчитывай ТОЛЬКО если: (1) слова переставлены местами, но сказаны; (2) различается лишь написание, а не звук: хамза (أ إ ا ء), «ي/ى», «ة/ه» на конце, слитное или раздельное написание, приставки «و/ف/ب/ل» слитно или раздельно, «ال» с хамзой или без.',
    'НЕ засчитывай ни в коем случае, если в слове другая согласная буква, пропущена или добавлена согласная, слово заменено другим или синонимом. Особенно НЕ прощай замену похожих по звучанию букв: ص/س, ح/خ/ه, ق/ك, ع/ا/ء, ذ/ز/د, ط/ت, ض/د, ث/س/ت, ظ/ز — это настоящие ошибки чтения, их нельзя считать «ошибкой распознавания». Распознавание речи здесь надёжное, поэтому искажённое слово — это ошибка человека. Сомневаешься — не засчитывай.',
    'Ответ — только JSON вида {"verdicts":[{"i":номер,"reason":"очень кратко почему","accept":true или false}]} — по одному элементу на каждое спорное слово.',
  ].join(' ') : [
    'Ты помогаешь проверять заучивание хадиса по русскому переводу. Человек проговорил хадис вслух, речь распознана автоматически и может содержать ошибки распознавания.',
    'Дан эталонный текст, распознанная речь и список слов эталона, которые алгоритм счёл ошибкой или пропуском (i — просто идентификатор слова, w — слово эталона, said — что алгоритм сопоставил). Для каждого слова реши по смыслу: есть ли это слово эталона (в любой форме и в любом месте) в распознанной речи «сказано». Если есть — засчитай.',
    'Засчитывай, если: слова переставлены местами, но сказаны (пример: эталон «Его Посланнику», сказано «посланнику Его» — слова «Его» и «Посланнику» оба засчитать, их нет смысла считать ошибкой); это другая форма того же слова или ошибка распознавания (близкое звучание, омофоны); разное слитное/раздельное написание; число цифрой или словом.',
    syn ? 'Засчитывай также замену слова близким синонимом, если смысл остаётся тем же.' : 'Замену слова другим словом (в том числе синонимом) НЕ засчитывай.',
    'НЕ засчитывай, если слово действительно пропущено или заменено словом другого смысла. Сомневаешься — не засчитывай.',
    'Ответ — только JSON вида {"verdicts":[{"i":номер,"reason":"очень кратко почему","accept":true или false}]} — по одному элементу на каждое спорное слово; accept=true значит «слово сказано верно, засчитать», accept=false значит «слово не сказано или заменено другим по смыслу, ошибка».',
  ].join(' ')
  const user = JSON.stringify({ эталон: String(b.ref ?? '').slice(0, 6000), сказано: String(b.said ?? '').slice(0, 6000), спорные_слова: flagged })
  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${DEEPSEEK}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-chat', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  })
  if (!r.ok) throw new Error(`DeepSeek ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  let accept: number[] = []
  try { const p = JSON.parse(j.choices?.[0]?.message?.content ?? '{}'); accept = Array.isArray(p.verdicts) ? p.verdicts.filter((v: Any) => v?.accept === true).map((v: Any) => v.i) : (p.accept ?? []) } catch { /* ответ не по форме — ничего не засчитываем */ }
  const ok = new Set(flagged.map((f) => f.i))
  return { accept: accept.filter((i) => Number.isInteger(i) && ok.has(i)), ...(b.debug ? { raw: j.choices?.[0]?.message?.content } : {}) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST' }, 405)
  try {
    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const form = await req.formData()
      const w = await who(req, String(form.get('init') ?? ''))
      const rec = String(form.get('rec') ?? '') || crypto.randomUUID() // старые версии без номера записи: каждая часть — отдельная проверка
      await take(w, rec)
      try {
        const res = await transcribe(form, w)
        if (SAVE && String(form.get('save') ?? '') === '1') background(saveSample(w, form, res))
        return json(res)
      } catch (e) { await refund(w, rec); throw e } // не распознали — проверку возвращаем
    }
    const b = await req.json()
    if (b.action === 'judge') return json(await judge(b, await who(req, String(b.init ?? ''))))
    if (b.action === 'access') return json(await access(await who(req, String(b.init ?? ''))))
    if (b.action === 'status') return json({ groq: !!GROQ, deepseek: !!DEEPSEEK, gemini: !!GEMINI, arEngine: AR_GEMINI ? 'both' : 'groq', save: SAVE }) // подключены ли ключи (сами ключи не показываем)
    return json({ error: 'unknown action' }, 400)
  } catch (e) {
    if (e instanceof Paywall) return json({ error: e.message, paywall: true, daycap: e.daycap }, 402)
    if (e instanceof Limit) return json({ error: e.message, limit: true }, 429)
    return json({ error: String((e as Error).message ?? e) }, 500)
  }
})
