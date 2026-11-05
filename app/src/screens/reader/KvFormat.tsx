import type { ReactNode } from 'react'
import { Plain, useTerms, type Terms } from '../../components/TermText'

// Оформление «Комментариев» Кулиева. Слова книги не меняются, только вид:
//  • длинные цитаты (слова хадиса, богослова) — отдельным блоком с золотой чертой слева,
//    даже если цитата идёт через несколько абзацев;
//  • имена передатчиков и богословов в местах вроде «Ибн Касир писал», «со слов Абу Хурейры» — жирным;
//  • аяты «…» (1:5) — золотым, как в тафсире;
//  • перечисления («Первая составляющая —», «Во-первых») — с новой строки, начало жирным;
//  • «Этот хадис передали …» — мелкой строкой под хадисом;
//  • «мир ему и благословение Аллаха» — приглушённо;
//  • длинный сплошной текст делится на абзацы по предложениям.
// Без «lookbehind» в регулярных выражениях — его не понимают старые iPhone.

const REF_S = '\\(\\d{1,3}:\\d{1,3}(?:[-–]\\d{1,3})?\\)'
const TAIL = /(?:Этот хадис|Эти хадисы|Этот рассказ|Это предание|Эту версию хадиса|Этот вариант хадиса)(?:[^«».]|«[^«»]*»)*\.(?=\s|$)/g
const ORD = /^(?:(?:Перв|Втор|Трет|Четв[её]рт|Пят|Шест|Седьм|Восьм|Девят|Десят)(?:ая|ой|ый|ий|ья|ье|ое) [а-яё]+(?: [а-яё]+)? ?[—–]|Во-первых|Во-вторых|В-третьих|В-четв[её]ртых|В-пятых|В-шестых|\d{1,2}\))/
const BLESS_S = 'мир ему и благословение Аллаха|мир им и благословение Аллаха|мир им обоим|мир ему|мир ей|да благословит его Аллах и приветствует|да будет доволен (?:им|ею|ими|ими обоими) Аллах|да смилуется над (?:ним|ними|нею) Аллах|да возвеличится Его хвала|да возвеличится Его упоминание'

// имя: слова с заглавной буквы и связки «ибн», «аль-…», «Абд ар-…»; первым не может быть служебное слово
const NOT = '(?!(?:Тогда|Затем|Потом|Когда|Он|Она|Оно|Они|Я|Мы|Вы|Ты|Люди|Аллах[а-я]*|Всевышн[а-я]*|Пророк[а-я]*|Посланник[а-я]*|Господ[а-я]*|Бог[а-я]*|Один|Одна|Некоторые|Другие|Все|Это|Этот|Эта|Эти|Также|Однако|Ведь|И|А|Но|Поэтому|Тот|Та|Те|Кто|Как|Если|Так|Там|Тут|После|Наконец|Вдруг|Однажды|Сначала|Сам|Сама|Сами|Многие|Некий|Некто|Коран[а-я]*|Писани[а-я]*|Ангел[а-я]*|Мой|Моя|Мои|Его|Ее|Её|Их|Сподвижник[а-я]*|Мусульман[а-я]*|Иуде[а-я]*|Христиан[а-я]*|Язычник[а-я]*|Мужчина|Женщина|Каждый|Никто|Ни|Да|Нет|Почему|Что|Где|Шейх|Царь|Царя|Мальчик|Мне|Ему|Нам|Им|Тому|Вот|Твои|Твой|Твоя|Другой|Другая|Неверующ[а-я]*|Глупц[а-я]*|Потому|Араб[а-я]*|Товарищ[а-я]*|Бадр[а-я]*|Бану|Племя|Род|Жители|Мекканцы|Курайшит[а-я]*|Ансар[а-я]*|Мухаджир[а-я]*|Лицемер[а-я]*|Пусть|Пока|Здесь|Теперь|Тем|Тех|Затем)(?![а-яё-]))'
const W = NOT + "[А-ЯЁ][а-яё’‘ʼ']+(?:-[А-ЯЁа-яё][а-яё’‘ʼ']+)?"
const PART = "(?:" + W + "|(?:аль|ас|ат|ад|ан|ар|аз|аш|ас|уль|ан)-[А-ЯЁа-яё][а-яё’‘ʼ']+|ибн|бинт|бин)"
const NAME = "(?:" + W + "|(?!ас-Сахих|аль-Сахих)(?:аль|ас|ат|ад|ан|ар|аз|аш)-[А-ЯЁ][а-яё’‘ʼ']+)(?: " + PART + "){0,5}"
const SAY = '(?:писал[аи]?|пишет|сказал[аи]?|говорил[аи]?|рассказывал[аи]?|рассказал[аи]?|передал[аи]?|передавал[аи]?|сообщил[аи]?|сообщает|отметил[аи]?|пояснил[аи]?|разъяснил[аи]?|ответил[аи]?|спросил[аи]?|считал[аи]?|полагал[аи]?|заметил[аи]?|добавил[аи]?|упомянул[аи]?|приводит|привел[аи]?|привёл|утверждал[аи]?|толковал[аи]?|комментировал[аи]?|продолжал[аи]?|воскликнул[аи]?|назвал[аи]?|писали|пишут|говорят|сказано)(?![а-яё])'
const CTX = '(?:[Шш]ейх|[Ии]мам|[Хх]афиз|со слов|хадис[аеуом]{0,2}|хадисе|Передают, что|передают, что|рассказ[аеуом]{0,2})'

// порядок групп: 1 — аят «…» (1:5), 2 — ссылка (1:5), 3 — благословение, 4+5 — «со слов» + имя, 6 — имя перед «сказал»
const INLINE = new RegExp(
  '(«[^«»]*»\\s*' + REF_S + ')' +
  '|(' + REF_S + ')' +
  '|(' + BLESS_S + ')' +
  '|(' + CTX + ' )(' + NAME + ')' +
  '|(' + NAME + ')(?= ' + SAY + '|, ' + SAY + ')',
  'g')

const REF_IN = new RegExp('^(.*?)\\s*(' + REF_S + ')$', 's')

/** Строка текста с выделениями */
function Inline({ t, start, terms }: { t: string; start?: boolean; terms: Terms }) {
  const out: ReactNode[] = []
  let s = t
  if (start) {
    const q = s.startsWith('«') ? '«' : ''
    const m = ORD.exec(s.slice(q.length))
    if (m) { out.push(q, <b key="ord" className="kv-mark">{m[0]}</b>); s = s.slice(q.length + m[0].length) }
  }
  let last = 0, m: RegExpExecArray | null
  INLINE.lastIndex = 0
  while ((m = INLINE.exec(s))) {
    if (m.index > last) out.push(<Plain key={'p' + last} t={s.slice(last, m.index)} terms={terms} />)
    const k = m.index
    if (m[1]) {
      const r = REF_IN.exec(m[1])!
      out.push(<span key={k} className="kv-ayah">{r[1]}</span>, ' ', <span key={k + 'r'} className="kv-ref">{r[2].slice(1, -1)}</span>)
    } else if (m[2]) out.push(<span key={k} className="kv-ref">{m[2].slice(1, -1)}</span>)
    else if (m[3]) out.push(<span key={k} className="kv-bl">{m[3]}</span>)
    else if (m[5]) out.push(m[4], <b key={k} className="kv-name">{m[5]}</b>)
    else if (m[6]) out.push(<b key={k} className="kv-name">{m[6]}</b>)
    last = k + m[0].length
    if (m[0].length === 0) INLINE.lastIndex++
  }
  if (last < s.length) out.push(<Plain key={'p' + last} t={s.slice(last)} terms={terms} />)
  return <>{out}</>
}

type Unit = { text: string; tail: string }

/** Абзацы книги → куски «текст + строка источника»: «Этот хадис передали …» закрывает кусок */
function units(paras: string[]): Unit[][] {
  const out: Unit[] = []
  for (const p of paras) {
    let from = 0, m: RegExpExecArray | null
    TAIL.lastIndex = 0
    const local: Unit[] = []
    while ((m = TAIL.exec(p))) {
      local.push({ text: p.slice(from, m.index).trim(), tail: m[0] })
      from = m.index + m[0].length
    }
    const rest = p.slice(from).trim()
    if (rest) local.push({ text: rest, tail: '' })
    out.push(...local)
  }
  // цитата может идти через несколько абзацев — склеиваем их, пока кавычка не закроется
  const groups: Unit[][] = []
  let cur: Unit[] = []
  let depth = 0
  const close = () => { if (cur.length) groups.push(cur); cur = []; depth = 0 }
  for (const u of out) {
    if (depth > 0 && /^(Передают|В другом хадисе|В другой версии)/.test(u.text)) {
      // кавычка в книге не закрыта — не тянем её дальше
      groups.push(...cur.map((x) => [x])); cur = []; depth = 0
    }
    cur.push(u)
    for (const c of u.text) { if (c === '«') depth++; else if (c === '»' && depth > 0) depth-- }
    if (depth === 0 || u.tail) close()
  }
  if (cur.length) groups.push(...(cur.length > 1 ? cur.map((x) => [x]) : [cur]))
  return groups
}

/** Делит длинные абзацы по предложениям (вне коротких цитат) и ставит перечисления с новой строки */
function breakText(t: string): string {
  // длина самой внутренней цитаты в каждой точке: делить можно вне цитат и внутри длинных цитат
  // (рассказ, внутри которого диалог, внутри которого ещё слова), но не внутри коротких реплик
  const inner = new Array<number>(t.length + 1).fill(Infinity)
  {
    const open: number[] = []
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '«') open.push(i)
      else if (t[i] === '»' && open.length) {
        const s = open.pop()!
        for (let j = s + 1; j < i; j++) if (inner[j] === Infinity) inner[j] = i - s
      }
    }
    for (const s of open.reverse()) for (let j = s + 1; j < t.length; j++) if (inner[j] === Infinity) inner[j] = t.length - s
  }
  let out = ''
  let len = 0
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    out += c
    len++
    if (c === '\n') { len = 0; continue }
    if (!'.!?…»'.includes(c)) continue
    if (c === '»' && !'.!?…'.includes(t[i - 1] ?? '')) continue
    if (inner[i + 1] < 250) continue
    const next = t.slice(i + 1)
    const ws = /^ +(?=[А-ЯЁ«])/.exec(next)
    if (!ws) continue
    const after = next.slice(ws[0].length)
    const nl = after.indexOf('\n')
    const restLen = nl < 0 ? after.length : nl
    if (ORD.test(after) || (len > 300 && restLen > 100)) {
      out += '\n'
      i += ws[0].length
      len = 0
    }
  }
  return out
}

type Seg = { k: 't' | 'q'; v: string; open?: boolean }

/** Обычный текст и цитаты верхнего уровня «…» (вложенные кавычки остаются внутри) */
function splitQuotes(t: string): Seg[] {
  const out: Seg[] = []
  let depth = 0, from = 0
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '«') { if (depth === 0) { if (i > from) out.push({ k: 't', v: t.slice(from, i) }); from = i } depth++ }
    else if (t[i] === '»' && depth > 0) { depth--; if (depth === 0) { out.push({ k: 'q', v: t.slice(from, i + 1) }); from = i + 1 } }
  }
  if (from < t.length) out.push(depth > 0 ? { k: 'q', v: t.slice(from), open: true } : { k: 't', v: t.slice(from) })
  return out
}

type Row = { k: 'p'; parts: string[] } | { k: 'q'; lines: string[] }

/** Кусок текста → абзацы и блоки цитат */
function rows(t: string): Row[] {
  const segs = splitQuotes(breakText(t))
  const out: Row[] = []
  let p: string[] | null = null
  const para = () => { if (!p) { p = []; out.push({ k: 'p', parts: p }) } return p }
  for (let i = 0; i < segs.length; i++) {
    const sg = segs[i]
    if (sg.k === 't') {
      sg.v.split('\n').forEach((x, j) => { if (j > 0) p = null; if (x.trim()) para().push(j > 0 ? x.trimStart() : x) })
      continue
    }
    // знаки и ссылка на аят сразу после кавычки остаются с цитатой
    let rest = ''
    const nx = segs[i + 1]
    if (nx && nx.k === 't') {
      const m = new RegExp('^((?:\\s*' + REF_S + ')?[.,;:!?…]*)').exec(nx.v)
      if (m && m[1]) { rest = m[1]; segs[i + 1] = { k: 't', v: nx.v.slice(m[1].length) } }
    }
    const isAyah = new RegExp('^\\s*' + REF_S).test(rest)
    // слова человека после «писал:», «сказал:» — с новой строки отдельным блоком (короткие реплики вроде «Да!» остаются в строке)
    const prev = i > 0 && segs[i - 1].k === 't' ? segs[i - 1].v : ''
    const said = /:\s*$/.test(prev) && sg.v.length >= 60
    const long = sg.v.includes('\n') || (!isAyah && (sg.v.length >= 160 || said)) || sg.v.length >= 700
    if (long) {
      p = null
      out.push({ k: 'q', lines: (sg.v + rest).split('\n').map((x) => x.trim()).filter(Boolean) })
    } else para().push(sg.v + rest)
  }
  return out.filter((r) => r.k === 'q' || r.parts.join('').trim())
}

function Rows({ t, terms }: { t: string; terms: Terms }) {
  return (
    <>
      {rows(t).map((r, i) => r.k === 'p'
        ? <p key={i} className="kv-p"><Inline t={r.parts.join('').replace(/^\s+/, '')} start terms={terms} /></p>
        : <div key={i} className="kv-q">{r.lines.map((l, j) => <p key={j}><Inline t={l} start terms={terms} /></p>)}</div>)}
    </>
  )
}

/** Одна запись комментария (несколько абзацев книги) */
export function KvNote({ paras }: { paras: string[] }) {
  const terms = useTerms() // каждый термин подсвечиваем один раз на запись
  return (
    <>
      {units(paras).map((g, i) => (
        <div key={i} className="kv-u">
          <Rows t={g.map((u) => u.text).filter(Boolean).join('\n')} terms={terms} />
          {g[g.length - 1].tail && <div className="kv-tail">{g[g.length - 1].tail}</div>}
        </div>
      ))}
    </>
  )
}
