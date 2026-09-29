import { Fragment } from 'react'

// Оформление текстов азкаров для удобного чтения:
//  • вводная фраза («Передают, что Пророк сказал:») — отдельной строкой, обычным шрифтом;
//  • сама мольба — жирным; скобки и слова в скобках — обычным;
//  • пометки «(УТРОМ)», «(три раза)» — отдельной строкой, мелко.

type Para = { kind: 'label' | 'intro' | 'main' | 'note'; text: string }

function splitRu(text: string): Para[] {
  const out: Para[] = []
  for (let p of text.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean)) {
    // пометка в начале: «(УТРОМ).»
    const label = p.match(/^\(([^()]{1,30})\)\.?\s*/)
    if (label) { out.push({ kind: 'label', text: label[1] }); p = p.slice(label[0].length) }
    // вводная фраза перед цитатой: «…сказал: «…»»
    let note: string | null = null
    const tail = p.match(/^([\s\S]*[»”][.,;]?)\s+(\([^()]{1,60}\)\.?)$/)
    if (tail) { p = tail[1]; note = tail[2] }
    const intro = p.match(/^([\s\S]{3,400}?:)\s*(«[\s\S]+)$/)
    if (intro) {
      out.push({ kind: 'intro', text: intro[1] })
      out.push({ kind: 'main', text: intro[2] })
    } else if (p) out.push({ kind: 'main', text: p })
    if (note) out.push({ kind: 'note', text: note.replace(/^\(|\)\.?$/g, '') })
  }
  return out
}

/** Текст с выделением скобок: основное — жирным (в мольбе), скобки — обычным */
function withBrackets(text: string) {
  return text.split(/(\([^()]*\)|\[[^\]]*\])/).map((part, i) =>
    /^[([]/.test(part) ? <span key={i} className="azt-br">{part}</span> : <Fragment key={i}>{part}</Fragment>,
  )
}

export function RuText({ text }: { text: string }) {
  return (
    <div className="azt-ru">
      {splitRu(text).map((p, i) =>
        p.kind === 'label' ? <div key={i} className="azt-label">{p.text}</div>
          : p.kind === 'note' ? <div key={i} className="azt-label">{p.text}</div>
            : <p key={i} className={p.kind === 'intro' ? 'azt-intro' : 'azt-main'}>{withBrackets(p.text)}</p>,
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
              : /^\(/.test(part) ? <span key={j} className="azt-arnote">{part}</span>
                : <Fragment key={j}>{part}</Fragment>,
          )}
        </p>
      ))}
    </div>
  )
}
