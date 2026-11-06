// Напоминания через бота «Коран и Сунна» (Supabase Edge Function).
//  • Приложение (внутри Telegram) присылает сюда настройки напоминаний — подпись Telegram проверяется.
//  • Раз в минуту расписание базы (pg_cron) будит функцию — она отправляет тем, кому пора, сообщение от бота.
// Секрет BOT_TOKEN — тот же, что у функции quran-bot. Ключ расписания лежит в таблице qs_config (remind_cron_key).
import { createClient } from 'npm:@supabase/supabase-js@2'

const TOKEN = Deno.env.get('BOT_TOKEN') ?? ''
const APP_URL = 'https://dinaraliev2002.github.io/quran-sunna/'
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

// deno-lint-ignore no-explicit-any
type Any = any
const KEYS = ['review', 'morning', 'evening', 'friday', 'streak'] as const
type Key = (typeof KEYS)[number]
const WINDOW_MIN = 30 // если расписание опоздало, отправляем не позже чем через столько минут после назначенного времени
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' }

const api = async (method: string, body: Any = {}): Promise<Any> => {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  return r.json()
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const plural = (n: number, a: string, b: string, c: string) => {
  const m10 = n % 10, m100 = n % 100
  return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c
}

// ---------- проверка подписи Telegram у данных запуска мини-приложения ----------
const hmac = async (key: Uint8Array | string, msg: string) => {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? new TextEncoder().encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)))
}
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
async function checkInitData(raw: string): Promise<Any | null> {
  const p = new URLSearchParams(raw)
  const hash = p.get('hash'); p.delete('hash')
  if (!hash || !TOKEN) return null
  const str = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n')
  const secret = await hmac('WebAppData', TOKEN)
  if (hex(await hmac(secret, str)) !== hash) return null
  if (Date.now() / 1000 - Number(p.get('auth_date') ?? 0) > 86400) return null
  try { return JSON.parse(p.get('user') ?? 'null') } catch { return null }
}

// ---------- настройки из приложения ----------
const validTz = (tz: unknown): string => {
  if (typeof tz !== 'string') return 'UTC'
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return tz } catch { return 'UTC' }
}
const toInt = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d)

async function saveRemind(userId: number, r: Any) {
  const cfg: Any = {}
  for (const k of KEYS) {
    const c = r?.cfg?.[k]
    cfg[k] = { on: !!c?.on, t: /^([01]\d|2[0-3]):[0-5]\d$/.test(c?.t) ? c.t : '20:00' }
  }
  const due = (Array.isArray(r?.due) ? r.due : []).slice(0, 31).map((x: unknown) => Math.max(0, toInt(x)))
  const row = {
    user_id: userId, tz: validTz(r?.tz), cfg, can_write: !!r?.write,
    base: toInt(r?.base), due, streak: Math.max(0, toInt(r?.streak)),
    last_day: /^\d{4}-\d{2}-\d{2}$/.test(r?.lastDay) ? r.lastDay : '', updated_at: new Date().toISOString(),
  }
  const { error } = await db.from('qs_remind').upsert(row)
  if (error) throw error
}

// ---------- рассылка ----------
const fmt = new Map<string, Intl.DateTimeFormat>()
/** Какое сейчас время у человека: дата ГГГГ-ММ-ДД, минуты от полуночи, пятница ли */
function localNow(tz: string) {
  let f = fmt.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' })
    fmt.set(tz, f)
  }
  const p: Record<string, string> = {}
  for (const x of f.formatToParts(new Date())) p[x.type] = x.value
  const date = `${p.year}-${p.month}-${p.day}`
  return { date, min: Number(p.hour) * 60 + Number(p.minute), friday: p.weekday === 'Fri', num: Math.floor(Date.UTC(+p.year, +p.month - 1, +p.day) / 864e5) }
}

interface Msg { text: string; go: string }
function build(key: Key, r: Any, now: ReturnType<typeof localNow>): Msg | null {
  switch (key) {
    case 'review': {
      const due: number[] = r.due ?? []
      if (!due.length) return null
      const n = due[Math.min(Math.max(now.num - r.base, 0), due.length - 1)]
      if (n <= 0) return null
      return { go: '/hifz', text: `<b>Пора повторить</b>\nНа повтор: ${n} ${plural(n, 'отрывок', 'отрывка', 'отрывков')} из хадисов и Корана. Это займёт несколько минут.` }
    }
    case 'morning': return { go: '/azkar', text: '<b>Утренние азкары</b>\nНачните день с поминания Аллаха.' }
    case 'evening': return { go: '/azkar', text: '<b>Вечерние азкары</b>\nЗавершите день с поминанием Аллаха.' }
    case 'friday': return { go: '/read/18', text: '<b>Сегодня пятница</b>\nПрочитайте суру «Аль-Кахф» и чаще призывайте благословение на Пророка ﷺ.' }
    case 'streak': {
      if (r.last_day === now.date) return null // сегодня уже занимались
      const yesterday = new Date((now.num - 1) * 864e5).toISOString().slice(0, 10)
      const known = r.streak > 0 && r.last_day === yesterday
      return {
        go: '/quran',
        text: known
          ? `<b>Серия: ${r.streak} ${plural(r.streak, 'день', 'дня', 'дней')}</b>\nЗагляните на 5 минут, чтобы серия не прервалась.`
          : '<b>Не прерывайте серию</b>\nСегодня ещё не читали. Загляните на 5 минут.',
      }
    }
  }
}

async function remindUser(r: Any) {
  const cfg = r.cfg ?? {}
  const now = localNow(r.tz || 'UTC')
  const sent: Record<string, string> = { ...(r.sent ?? {}) }
  let changed = false
  for (const key of KEYS) {
    const c = cfg[key]
    if (!c?.on || typeof c.t !== 'string') continue
    const [h, m] = c.t.split(':').map(Number)
    const late = now.min - (h * 60 + m)
    if (late < 0 || late >= WINDOW_MIN || sent[key] === now.date) continue
    if (key === 'friday' && !now.friday) continue
    sent[key] = now.date; changed = true // помечаем заранее, чтобы не отправить дважды
    const msg = build(key, r, now)
    if (!msg) continue
    const res = await api('sendMessage', {
      chat_id: r.user_id, text: msg.text, parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '📖 Открыть', web_app: { url: `${APP_URL}?go=${encodeURIComponent(msg.go)}` } }]] },
    })
    if (!res.ok) {
      if (res.error_code === 403) { // человек остановил бота или не разрешил писать ему
        await db.from('qs_remind').update({ can_write: false }).eq('user_id', r.user_id)
        await db.from('qs_users').update({ blocked: true }).eq('id', r.user_id)
        break
      }
      console.error('send failed', r.user_id, res.description)
    }
    await sleep(40)
  }
  if (changed) await db.from('qs_remind').update({ sent }).eq('user_id', r.user_id)
}

async function tick() {
  const { data } = await db.from('qs_remind').select('*').eq('can_write', true)
  for (const r of data ?? []) {
    try { await remindUser(r) } catch (e) { console.error('remind error', r.user_id, e) }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return new Response('ok')
  // будит расписание базы
  const cron = req.headers.get('x-cron-key')
  if (cron) {
    const { data } = await db.from('qs_config').select('value').eq('key', 'remind_cron_key').maybeSingle()
    if (!data || data.value !== cron) return new Response('forbidden', { status: 403 })
    await tick()
    return new Response('ok')
  }
  // настройки из приложения
  try {
    const { initData, remind } = await req.json()
    const u = typeof initData === 'string' ? await checkInitData(initData) : null
    if (u?.id) {
      await saveRemind(u.id, remind)
      return new Response('ok', { headers: CORS })
    }
  } catch (e) { console.error('save error', e) }
  return new Response('forbidden', { status: 403, headers: CORS })
})
