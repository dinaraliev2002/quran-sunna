// Проверка речи при заучивании (Supabase Edge Function «stt-check»).
//  1) Голос → текст: Groq (Whisper large-v3-turbo). Приложение присылает запись (multipart: поле audio).
//  2) Решение «ошибка или нет»: DeepSeek смотрит на слова, которые алгоритм счёл ошибками, и говорит, какие из них можно
//     засчитать (перестановка «посланнику Его» / «Его посланнику», ошибка распознавания, при желании — близкий синоним).
// Секреты (Edge Functions → Secrets): GROQ_API_KEY_APK, DEEPSEEK_API_KEY_APK (подходят и GROQ_API_KEY / DEEPSEEK_API_KEY). Verify JWT — выключить, как у остальных функций.
// Расходы ограничены самими аккаунтами: у Groq лимиты бесплатного уровня, у DeepSeek — внесённый баланс.

// ключ берём первый подходящий: только печатные ASCII-символы (случайно вставленная заглушка вроде «ВАШ_КЛЮЧ» не годится)
const pick = (...names: string[]) => names.map((n) => (Deno.env.get(n) ?? '').trim()).find((v) => /^[!-~]{10,}$/.test(v)) ?? ''
const GROQ = pick('GROQ_API_KEY_APK', 'GROQ_API_KEY')
const DEEPSEEK = pick('DEEPSEEK_API_KEY_APK', 'DEEPSEEK_API_KEY')
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' }
const MAX_AUDIO = 12 * 1024 * 1024 // ~12 МБ: хватает на несколько минут речи

// deno-lint-ignore no-explicit-any
type Any = any
const json = (body: Any, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

/** Голос → текст через Groq. Подсказка у Whisper общая: полный текст хадиса не даём, иначе он «дорисует» его вместо услышанного */
async function transcribe(form: FormData) {
  if (!GROQ) throw new Error('нет GROQ_API_KEY')
  const file = form.get('audio')
  if (!(file instanceof File)) throw new Error('нет записи')
  if (file.size > MAX_AUDIO) throw new Error('запись слишком длинная')
  const out = new FormData()
  out.append('file', file, file.name || 'rec.webm')
  // модель: turbo (быстрее, дешевле) или полная large-v3 (точнее); выбирает приложение
  const model = String(form.get('model') ?? '') === 'whisper-large-v3' ? 'whisper-large-v3' : 'whisper-large-v3-turbo'
  out.append('model', model)
  out.append('language', 'ru')
  out.append('response_format', 'json')
  out.append('temperature', '0')
  // подсказку не даём: Whisper начинал повторять её вместо речи и выкидывал куски длинных записей
  if (String(form.get('prompt') ?? '') === '1') out.append('prompt', 'Хадис Пророка Мухаммада. Посланник Аллаха сказал.')
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${GROQ}` }, body: out })
  if (!r.ok) throw new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  return { text: String(j.text ?? '').trim() }
}

/** Какие спорные слова эталона можно засчитать */
async function judge(b: Any) {
  const flagged: { i: number; w: string; said?: string }[] = Array.isArray(b.flagged) ? b.flagged.slice(0, 80) : []
  if (!DEEPSEEK || !flagged.length) return { accept: [] as number[] }
  const syn = !!b.syn
  const system = [
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
    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) return json(await transcribe(await req.formData()))
    const b = await req.json()
    if (b.action === 'judge') return json(await judge(b))
    if (b.action === 'status') return json({ groq: !!GROQ, deepseek: !!DEEPSEEK }) // подключены ли ключи (сами ключи не показываем)
    return json({ error: 'unknown action' }, 400)
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500)
  }
})
