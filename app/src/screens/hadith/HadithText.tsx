import { Fragment } from 'react'
import { isSourcePara } from '../../lib/hadith'

// Оформление текста хадиса:
//  • «54 — Передают со слов…» — номер хадиса золотым значком, вводные слова (до двоеточия) — приглушённо;
//  • слова Пророка ﷺ — основным текстом; **цитаты аятов** — жирным;
//  • «Этот хадис передали аль-Бухари 6094…» — мелко, как источник.

function bold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>))
}

export function RuParas({ paras }: { paras: string[] }) {
  return (
    <div className="hd-ru">
      {paras.map((p, i) => {
        const num = p.match(/^(\d{1,4})\s*[—–-]\s+/)
        const body = num ? p.slice(num[0].length) : p
        if (isSourcePara(body)) return <p key={i} className="hd-src">{bold(body)}</p>
        const intro = /:$/.test(body.trim()) && body.length < 400
        return (
          <p key={i} className={intro ? 'hd-intro' : undefined}>
            {num && <span className="hd-n">{num[1]}</span>}
            {bold(body)}
          </p>
        )
      })}
    </div>
  )
}

export function ArParas({ paras }: { paras: string[] }) {
  return (
    <div className="hd-ar" dir="rtl">
      {paras.map((p, i) => <p key={i}>{bold(p)}</p>)}
    </div>
  )
}

/** «54. Поистине, правдивость…» → номер и заголовок; «1. Глава: О том…» → «Глава 1» и заголовок */
export function splitTitle(t: string): { no: string; title: string } {
  const m = t.match(/^(\d{1,4})\.\s*(Глава:?\s*)?(.*)$/)
  if (!m) return { no: '', title: t }
  return { no: m[2] ? `Глава ${m[1]}` : m[1], title: m[3] }
}
