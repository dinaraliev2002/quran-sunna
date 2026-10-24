// Бот мини-приложения «Коран и Сунна» (Supabase Edge Function).
//  • /start — приветствие и кнопка «Открыть приложение»
//  • /feedback — обратная связь: сообщение уходит автору, автор отвечает прямо на него — ответ приходит человеку
//  • /support — поддержать проект (ссылка Tribute)
//  • для автора: /broadcast, /news, /stats, /settribute
// Секреты (Supabase → Edge Functions → Secrets): BOT_TOKEN, SETUP_KEY (буквы/цифры/_/-)
import { createClient } from 'npm:@supabase/supabase-js@2'

const TOKEN = Deno.env.get('BOT_TOKEN') ?? ''
const SETUP_KEY = Deno.env.get('SETUP_KEY') ?? ''
const APP_URL = 'https://dinaraliev2002.github.io/quran-sunna/'
const NEWS_URL = APP_URL + 'updates.json'
const FN_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/quran-bot`
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

// deno-lint-ignore no-explicit-any
type Any = any
const api = async (method: string, body: Any = {}): Promise<Any> => {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  return r.json()
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const openBtn = { inline_keyboard: [[{ text: '📖 Открыть приложение', web_app: { url: APP_URL } }]] }

async function getCfg(key: string): Promise<string | null> {
  const { data } = await db.from('qs_config').select('value').eq('key', key).maybeSingle()
  return data?.value ?? null
}
const setCfg = (key: string, value: string) => db.from('qs_config').upsert({ key, value })
const say = (chat_id: number, text: string, extra: Any = {}) =>
  api('sendMessage', { chat_id, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...extra })

async function register(u: Any, source?: string) {
  const row: Any = { id: u.id, first_name: u.first_name ?? null, username: u.username ?? null, last_seen: new Date().toISOString(), blocked: false }
  const { data } = await db.from('qs_users').select('id').eq('id', u.id).maybeSingle()
  if (!data) row.source = source ?? null
  await db.from('qs_users').upsert(row)
}


// ---------- регистрация тех, кто открыл мини-приложение (без переписки с ботом) ----------
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' }
const hmac = async (key: Uint8Array | string, msg: string) => {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? new TextEncoder().encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)))
}
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
/** Проверяет подпись Telegram у данных запуска мини-приложения; возвращает пользователя или null */
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

const who = (u: Any) => `${esc([u.first_name, u.last_name].filter(Boolean).join(' ') || 'Без имени')}${u.username ? ` (@${u.username})` : ''} · id ${u.id}`

// ---------- обычные пользователи ----------
const WELCOME =
  'Ас-саляму ‘алейкум! 🌿\n\nЭто бот приложения «Коран и Сунна».\n\n' +
  '📖 Нажмите кнопку ниже, чтобы открыть приложение.\n' +
  '✉️ /feedback — написать автору: предложение, вопрос, ошибка\n' +
  '🤍 /support — поддержать проект'

async function support(chat: number) {
  const url = await getCfg('tribute_url')
  if (!url) return say(chat, 'Спасибо за желание поддержать! Эта возможность скоро появится.')
  return say(chat, 'Приложение бесплатное и без рекламы. Если оно вам полезно, вы можете помочь проекту развиваться — любой суммой.\n\nДа вознаградит вас Аллах благом! 🤍',
    { reply_markup: { inline_keyboard: [[{ text: '🤍 Поддержать проект', url }]] } })
}

async function feedback(m: Any) {
  const admin = Number(await getCfg('admin_id') ?? 0)
  if (!admin) return say(m.chat.id, 'Сейчас сообщения автору принять не получится — попробуйте чуть позже.')
  // не больше 20 сообщений в час от одного человека
  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await db.from('qs_msgmap').select('*', { count: 'exact', head: true }).eq('user_id', m.from.id).gte('created_at', since)
  if ((count ?? 0) >= 20) return say(m.chat.id, 'Вы отправили много сообщений за последний час. Напишите чуть позже, ин ша Аллах.')
  const head = `✉️ <b>Обратная связь</b>\n${who(m.from)}`
  const keep = (res: Any) => res?.ok ? db.from('qs_msgmap').insert({ admin_msg_id: res.result.message_id, user_id: m.from.id }) : null
  if (m.text) {
    await keep(await say(admin, `${head}\n\n${esc(m.text)}`))
  } else {
    await keep(await say(admin, head))
    await keep(await api('copyMessage', { chat_id: admin, from_chat_id: m.chat.id, message_id: m.message_id }))
  }
  await say(m.chat.id, 'Передал автору ✓ Ответ придёт сюда, в этот чат.')
}

// ---------- автор ----------
async function adminReply(m: Any): Promise<boolean> {
  const rt = m.reply_to_message
  if (!rt) return false
  const { data } = await db.from('qs_msgmap').select('user_id').eq('admin_msg_id', rt.message_id).maybeSingle()
  if (!data) return false
  const to = Number(data.user_id)
  let res: Any
  if (m.text) res = await say(to, `💬 <b>Ответ автора</b>\n\n${esc(m.text)}`)
  else res = await api('copyMessage', { chat_id: to, from_chat_id: m.chat.id, message_id: m.message_id })
  if (!res.ok) {
    if (res.error_code === 403) await db.from('qs_users').update({ blocked: true }).eq('id', to)
    await say(m.chat.id, '⚠️ Не доставлено: человек остановил бота.')
  } else await say(m.chat.id, '✓ Ответ отправлен', { disable_notification: true })
  return true
}

async function usersCount() {
  const { count } = await db.from('qs_users').select('*', { count: 'exact', head: true }).eq('blocked', false)
  return count ?? 0
}

async function prepareBroadcast(chat: number, html: string) {
  await setCfg('pending_broadcast', html)
  const n = await usersCount()
  await say(chat, `Так увидят получатели:\n\n──────────\n${html}\n──────────\n\nПолучателей: <b>${n}</b>`, {
    reply_markup: { inline_keyboard: [[{ text: `Отправить (${n})`, callback_data: 'bc:yes' }, { text: 'Отмена', callback_data: 'bc:no' }]] },
  })
}

async function runBroadcast(chat: number) {
  const html = await getCfg('pending_broadcast')
  if (!html) return say(chat, 'Нет подготовленной рассылки.')
  await db.from('qs_config').delete().eq('key', 'pending_broadcast') // защита от двойной отправки
  const { data: users } = await db.from('qs_users').select('id').eq('blocked', false)
  let sent = 0, failed = 0
  for (const u of users ?? []) {
    let res = await say(u.id, html, { reply_markup: openBtn })
    if (!res.ok && res.error_code === 400) res = await api('sendMessage', { chat_id: u.id, text: html.replace(/<[^>]+>/g, ''), reply_markup: openBtn })
    if (res.ok) sent++
    else { failed++; if (res.error_code === 403) await db.from('qs_users').update({ blocked: true }).eq('id', u.id) }
    await new Promise((r) => setTimeout(r, 45)) // ≈ 20 сообщений в секунду — в пределах лимитов Telegram
  }
  await db.from('qs_broadcasts').insert({ text: html, sent, failed })
  await say(chat, `Рассылка завершена: доставлено <b>${sent}</b>, не доставлено ${failed}.`)
}

async function newsText(): Promise<string | null> {
  try {
    const d = await (await fetch(NEWS_URL, { cache: 'no-store' })).json()
    const n = d.items?.[0]
    if (!n) return null
    const pts = (n.points ?? []).map((p: string) => `• ${esc(p)}`).join('\n')
    return `<b>${n.kind === 'update' ? '🆕 Вышло обновление' : esc(n.title)}</b>\n\n${n.text ? esc(n.text) + '\n\n' : ''}${pts}`.trim()
  } catch { return null }
}

async function adminCommand(m: Any, cmd: string, rest: string): Promise<boolean> {
  const chat = m.chat.id
  if (cmd === '/stats') {
    const all = await db.from('qs_users').select('*', { count: 'exact', head: true })
    const act = await db.from('qs_users').select('*', { count: 'exact', head: true }).gte('last_seen', new Date(Date.now() - 7 * 86400_000).toISOString())
    const blk = await db.from('qs_users').select('*', { count: 'exact', head: true }).eq('blocked', true)
    await say(chat, `👥 Всего запустили бота: <b>${all.count}</b>\n🟢 Активны за неделю: <b>${act.count}</b>\n🚫 Остановили бота: ${blk.count}`)
    return true
  }
  if (cmd === '/broadcast') {
    const text = m.reply_to_message?.text ?? rest
    if (!text) { await say(chat, 'Напишите так: <code>/broadcast Текст сообщения</code>\nИли ответьте командой /broadcast на готовое сообщение.\nМожно использовать &lt;b&gt;жирный&lt;/b&gt; и &lt;i&gt;курсив&lt;/i&gt;.'); return true }
    await prepareBroadcast(chat, text); return true
  }
  if (cmd === '/news') {
    const t = await newsText()
    if (!t) await say(chat, 'Не удалось взять новости с сайта (updates.json).')
    else await prepareBroadcast(chat, t)
    return true
  }
  if (cmd === '/settribute') {
    if (!/^https:\/\/\S+$/.test(rest)) { await say(chat, 'Напишите так: <code>/settribute https://t.me/tribute/app?startapp=…</code>'); return true }
    await setCfg('tribute_url', rest); await say(chat, 'Ссылка на поддержку сохранена ✓'); await support(chat); return true
  }
  return false
}

async function onMessage(m: Any) {
  if (m.chat.type !== 'private' || !m.from) return
  const text: string = m.text ?? ''
  const cmd = text.startsWith('/') ? text.split(/[\s@]/)[0].toLowerCase() : ''
  const rest = text.replace(/^\/\S+\s*/, '').trim()
  const admin = Number(await getCfg('admin_id') ?? 0)
  const isAdmin = admin !== 0 && m.from.id === admin

  // закрепить себя автором: /admin КЛЮЧ
  if (cmd === '/admin') {
    if (SETUP_KEY && rest === SETUP_KEY) {
      await setCfg('admin_id', String(m.from.id))
      await api('deleteMessage', { chat_id: m.chat.id, message_id: m.message_id })
      await api('setMyCommands', { scope: { type: 'chat', chat_id: m.from.id }, commands: [
        { command: 'stats', description: 'Сколько пользователей' }, { command: 'news', description: 'Разослать «Что нового»' },
        { command: 'broadcast', description: 'Разослать своё сообщение' }, { command: 'settribute', description: 'Ссылка поддержки (Tribute)' },
        { command: 'start', description: 'Приветствие' } ] })
      await say(m.chat.id, 'Вы — автор ✓\n\n/stats — сколько людей в боте\n/news — разослать «Что нового» из приложения\n/broadcast текст — разослать своё сообщение\n/settribute ссылка — ссылка для поддержки\n\nСообщения от людей приходят сюда. Чтобы ответить — нажмите «Ответить» на сообщении.')
    }
    return
  }
  if (isAdmin) {
    if (cmd && await adminCommand(m, cmd, rest)) return
    if (!cmd && await adminReply(m)) return
  }
  await register(m.from, cmd === '/start' && rest ? rest : undefined)
  if (cmd === '/start') {
    if (rest === 'support') return support(m.chat.id)
    if (rest === 'feedback') return say(m.chat.id, '✉️ Напишите сюда ваше предложение, вопрос или сообщение об ошибке — я передам его автору. Можно прикрепить скриншот.')
    return say(m.chat.id, WELCOME, { reply_markup: openBtn })
  }
  if (cmd === '/support') return support(m.chat.id)
  if (cmd === '/feedback') return say(m.chat.id, '✉️ Напишите сюда ваше предложение, вопрос или сообщение об ошибке — я передам его автору. Можно прикрепить скриншот.')
  if (cmd) return say(m.chat.id, WELCOME, { reply_markup: openBtn })
  await feedback(m) // любое обычное сообщение — это обращение к автору
}

async function handle(u: Any) {
  try {
    if (u.message) await onMessage(u.message)
    else if (u.callback_query) {
      const q = u.callback_query
      const admin = Number(await getCfg('admin_id') ?? 0)
      await api('answerCallbackQuery', { callback_query_id: q.id })
      if (q.from.id === admin && q.data === 'bc:yes') {
        await api('editMessageReplyMarkup', { chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } })
        await say(admin, 'Рассылка пошла…'); await runBroadcast(admin)
      } else if (q.from.id === admin && q.data === 'bc:no') {
        await db.from('qs_config').delete().eq('key', 'pending_broadcast')
        await api('editMessageReplyMarkup', { chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } })
        await say(admin, 'Рассылка отменена.')
      }
    } else if (u.my_chat_member && u.my_chat_member.chat.type === 'private') {
      const st = u.my_chat_member.new_chat_member.status
      await db.from('qs_users').update({ blocked: st === 'kicked' }).eq('id', u.my_chat_member.from.id)
    }
  } catch (e) { console.error('bot error', e) }
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  // однократная настройка: открыть в браузере  <адрес функции>?setup=КЛЮЧ  (&force=1 — заменить уже стоящий вебхук)
  if (req.method === 'GET') {
    if (!SETUP_KEY || url.searchParams.get('setup') !== SETUP_KEY || !TOKEN) return new Response('ok')
    const info = await api('getWebhookInfo')
    const cur: string = info.result?.url ?? ''
    if (cur && cur !== FN_URL && url.searchParams.get('force') !== '1')
      return new Response(`У бота уже подключён другой вебхук:\n${cur}\nЕсли это не нужно — добавьте в конец адреса &force=1`, { status: 409 })
    const r = await api('setWebhook', { url: FN_URL, secret_token: SETUP_KEY, allowed_updates: ['message', 'callback_query', 'my_chat_member'], drop_pending_updates: false })
    await api('setMyCommands', { commands: [
      { command: 'start', description: 'Открыть приложение' }, { command: 'feedback', description: 'Написать автору' }, { command: 'support', description: 'Поддержать проект' } ] })
    const me = await api('getMe')
    return new Response(JSON.stringify({ webhook: r, bot: me.result?.username }, null, 1))
  }
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.headers.get('x-telegram-bot-api-secret-token') !== SETUP_KEY) {
    // запрос из самого приложения: «этот человек пользуется приложением»
    try {
      const { initData } = await req.json()
      const u = typeof initData === 'string' ? await checkInitData(initData) : null
      if (u?.id) {
        const { data } = await db.from('qs_users').select('id').eq('id', u.id).maybeSingle()
        if (data) await db.from('qs_users').update({ last_seen: new Date().toISOString(), first_name: u.first_name ?? null, username: u.username ?? null }).eq('id', u.id)
        else await db.from('qs_users').insert({ id: u.id, first_name: u.first_name ?? null, username: u.username ?? null, source: 'app' })
        return new Response('ok', { headers: CORS })
      }
    } catch { /* не наш запрос */ }
    return new Response('forbidden', { status: 403, headers: CORS })
  }
  const update = await req.json()
  // отвечаем Telegram сразу, а работу (в том числе долгую рассылку) доделываем в фоне
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime
  if (rt?.waitUntil) rt.waitUntil(handle(update)); else await handle(update)
  return new Response('ok')
})
