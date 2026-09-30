import { Fragment, type ReactNode } from 'react'
import type { Surah } from '../../lib/data'

// Оформление текстов азкаров для удобного чтения:
//  • вводная фраза («Передают, что Пророк сказал:») — отдельной строкой, обычным шрифтом;
//  • сама мольба — жирным; скобки и слова в скобках — обычным;
//  • пометки «(УТРОМ)», «(три раза)» — отдельной строкой, мелко;
//  • упоминания сур и аятов («суру «Земной поклон»», «аят трона») — ссылки, открывают Коран.

export type OpenQuran = (surah: number, ayah: number) => void
type Para = { kind: 'label' | 'intro' | 'main' | 'note'; text: string }

function splitRu(text: string): Para[] {
  const out: Para[] = []
  for (let p of text.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean)) {
    const label = p.match(/^\(([^()]{1,30})\)\.?\s*/)
    if (label) { out.push({ kind: 'label', text: label[1] }); p = p.slice(label[0].length) }
    let note: string | null = null
    // пометка в конце — только о повторах/времени: «(три раза)», «(утром)», а не «(Аль-Мульк, 67)»
    const tail = p.match(/^([\s\S]*[»”][.,;]?)\s+(\([^()]{1,60}\)\.?)$/)
    if (tail && /раз|трижды|утр|веч|ноч/i.test(tail[2])) { p = tail[1]; note = tail[2] }
    const intro = p.match(/^([\s\S]{3,400}?:)\s*(«[\s\S]+)$/)
    if (intro) {
      out.push({ kind: 'intro', text: intro[1] })
      out.push({ kind: 'main', text: intro[2] })
    } else if (p) out.push({ kind: 'main', text: p })
    if (note) out.push({ kind: 'note', text: note.replace(/^\(|\)\.?$/g, '') })
  }
  return out
}

// ---------- ссылки на суры и аяты ----------
type Link = { start: number; end: number; s: number; a: number }
const norm = (x: string) => x.toLowerCase().replace(/ё/g, 'е').replace(/[-\s]/g, '')

function findLinks(text: string, surahs: Surah[]): Link[] {
  const links: Link[] = []
  const add = (start: number, end: number, s: number, a = 1) => {
    if (!links.some((l) => start < l.end && end > l.start)) links.push({ start, end, s, a })
  }
  let m: RegExpExecArray | null
  // «два последних аята суры “Корова”», «два этих аята, находящихся в конце суры “Корова”» → 2:285
  const last2 = /дв(?:а|ух)[^.]{0,40}?аят(?:а|ов)[^.]{0,40}?сур[ыу]\s*[«“"]Корова[»”"]/gi
  while ((m = last2.exec(text))) add(m.index, m.index + m[0].length, 2, 285)
  // «аят трона», «аят Аль-Курси» → 2:255
  const kursi = /аят[аеу]?\s+(?:трона|Аль-Курси)(?:\s+2:255)?/gi
  while ((m = kursi.exec(text))) add(m.index, m.index + m[0].length, 2, 255)
  // «суры «Земной поклон»» — перевод названия в кавычках после слова «сура»
  const byMeaning = new Map(surahs.map((s) => [norm(s.meaning), s.id]))
  // любое название в кавычках, если в этом же предложении раньше есть слово «сура»
  const quoted = /[«“"]([^»”"«“]{2,40})[»”"]/g
  while ((m = quoted.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 90), m.index)
    const sentence = before.slice(Math.max(before.lastIndexOf('.'), before.lastIndexOf('!')) + 1)
    const id = byMeaning.get(norm(m[1]))
    if (id && /сур/i.test(sentence)) add(m.index, m.index + m[0].length, id) // вместе с кавычками
  }
  // транслит названия (Аль-Ихлас, Ас-Саджда…) — только рядом со словом «сура» или с номером суры
  const names = [...surahs].sort((a, b) => b.name.length - a.name.length)
  const nameRe = new RegExp(`(${names.map((s) => s.name.replace(/[-\s]/g, '[-\\s]')).join('|')})`, 'g')
  const byName = new Map(surahs.map((s) => [norm(s.name), s.id]))
  while ((m = nameRe.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 45), m.index)
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 8)
    if (/сур/i.test(before) || /^\s*[,(]\s*\d{1,3}\)?/.test(after)) {
      const id = byName.get(norm(m[0]))
      if (id) add(m.index, m.index + m[0].length, id)
    }
  }
  return links.sort((a, b) => a.start - b.start)
}

/** Текст с выделением скобок (обычным шрифтом) и ссылками на Коран */
function rich(text: string, surahs: Surah[] | null, open?: OpenQuran) {
  const links = surahs && open ? findLinks(text, surahs) : []
  const out: ReactNode[] = []
  let pos = 0
  const plain = (t: string, k: string) =>
    t.split(/(\([^()]*\)|\[[^\]]*\])/).forEach((part, i) =>
      out.push(/^[([]/.test(part) ? <span key={k + i} className="azt-br">{part}</span> : <Fragment key={k + i}>{part}</Fragment>))
  links.forEach((l, i) => {
    plain(text.slice(pos, l.start), 'p' + i)
    out.push(<button key={'l' + i} className="azt-link" onClick={() => open!(l.s, l.a)}>{text.slice(l.start, l.end)}</button>)
    pos = l.end
  })
  plain(text.slice(pos), 'end')
  return out
}

export function RuText({ text, surahs, onOpen }: { text: string; surahs?: Surah[] | null; onOpen?: OpenQuran }) {
  return (
    <div className="azt-ru">
      {splitRu(text).map((p, i) =>
        p.kind === 'label' || p.kind === 'note' ? <div key={i} className="azt-label">{p.text}</div>
          : <p key={i} className={p.kind === 'intro' ? 'azt-intro' : 'azt-main'}>{rich(p.text, surahs ?? null, onOpen)}</p>,
      )}
    </div>
  )
}

export function ArText({ text }: { text: string }) {
  return (
    <div className="azt-ar" dir="rtl">
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i}>
          {p.split(/(\([^()]*\)|\*)/).map((part, j) =>
            part === '*' ? <span key={j} className="azt-sep">۝</span>
              // мелко — только служебные пометки о числе повторов («ثلاث مرات»), а не цитаты
              : /^\(/.test(part) && /مر(ات|ة|تين)|ثلاث|سبع|عشر|مائة/.test(part) ? <span key={j} className="azt-arnote">{part}</span>
                : <Fragment key={j}>{part}</Fragment>,
          )}
        </p>
      ))}
    </div>
  )
}
