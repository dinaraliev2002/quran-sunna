import { Fragment } from 'react'

// Тафсир приходит одним сплошным текстом без абзацев. Делаем его удобным для чтения:
//  • абзац начинается со слов-переходов («Во-первых», «Затем», «Таким образом»…) или
//    закрывается примерно через 3–4 предложения;
//  • слова-переходы — жирным, цитаты из Корана «…» — выделены цветом.

const MARKERS = /^(Во-первых|Во-вторых|В-третьих|В-четвёртых|В-четвертых|Затем|Потом|Далее|Кроме того|Помимо этого|Таким образом|Иными словами|Иначе говоря|Однако|Поэтому|Что же касается|Следовательно|Это значит|Это означает|Всевышний (?:сказал|сообщил|поведал|разъяснил)|Аллах (?:сказал|сообщил)|Воистину|Затем Аллах|Затем Всевышний)/

function sentences(text: string): string[] {
  // конец предложения: . ! ? … (в т.ч. перед закрывающей кавычкой), дальше — заглавная буква или кавычка.
  // Без «lookbehind» в регулярном выражении — его не понимают старые iPhone.
  const parts = text.replace(/\s+/g, ' ').trim().split(/([.!?…][»”)]?)\s+(?=[«"„(—–-]?\s?[А-ЯЁA-Z])/)
  const out: string[] = []
  for (let i = 0; i < parts.length; i += 2) out.push(parts[i] + (parts[i + 1] ?? ''))
  return out.filter(Boolean)
}

function paragraphs(text: string): string[] {
  const out: string[] = []
  let cur: string[] = []
  let len = 0
  for (const s of sentences(text)) {
    const startNew = cur.length > 0 && ((MARKERS.test(s) && len > 100) || len > 320)
    if (startNew) { out.push(cur.join(' ')); cur = []; len = 0 }
    cur.push(s)
    len += s.length
  }
  if (cur.length) out.push(cur.join(' '))
  return out
}

function styled(p: string) {
  const m = p.match(MARKERS)
  const head = m ? m[0] : ''
  const rest = p.slice(head.length)
  const parts = rest.split(/(«[^«»]{2,}»)/)
  return (
    <>
      {head && <b className="tf-mark">{head}</b>}
      {parts.map((x, i) => (x.startsWith('«') ? <span key={i} className="tf-quote">{x}</span> : <Fragment key={i}>{x}</Fragment>))}
    </>
  )
}

export function TafsirText({ text }: { text: string }) {
  return (
    <div className="tafsir-txt">
      {paragraphs(text).map((p, i) => <p key={i}>{styled(p)}</p>)}
    </div>
  )
}
