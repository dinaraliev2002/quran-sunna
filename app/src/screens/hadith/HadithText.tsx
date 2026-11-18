import { Fragment, type ReactNode } from 'react'
import { isSourcePara } from '../../lib/hadith'
import { arForFont } from '../../lib/arabicFont'
import { useStore } from '../../store/settings'

// Оформление текста хадиса:
//  • кто передаёт («Сообщается, что Абу Хурайра сказал:») — обычным шрифтом;
//  • сам текст хадиса — жирным, пояснения переводчика в скобках — чуть тоньше;
//  • «Этот хадис передали аль-Бухари…» — мелко, как источник; всё после него — обычный комментарий;
//  • **цитаты аятов** — жирным.

const NUM = /^(\d{1,4}(?:\s*\((?:\d{1,4}|…|\.\.\.)\))?(?:\s*(?:,|и|[-–])\s*\d{1,4})*|\((?:\d{1,4}|…)\))\s*[—–]\s+/

const SOURCE_END = /\((?:[^()]*\s)?(?:аль-Бухари|Муслим|ат-Тирмизи|Абу Дауд|ан-Насаи|Ибн Маджа|Ахмад|Малик|аль-Байхаки|ад-Даракутни|Ибн Хиббан)[^()]*\d[^()]*\)\.?\s*$/

/** жирное из разметки **…** */
function bold(text: string, k = '') {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={k + i}>{part}</b> : <Fragment key={k + i}>{part}</Fragment>))
}
/** текст хадиса: скобки переводчика — тоньше */
function hadithText(text: string): ReactNode[] {
  return text.split(/(\([^()]*\))/).map((part, i) => (part.startsWith('(') ? <span key={i} className="hd-br">{bold(part, 'b' + i)}</span> : <Fragment key={i}>{bold(part, 't' + i)}</Fragment>))
}

/** «Сообщается, что Анас сказал: «…»» → вводные слова и сам текст */
function splitIntro(p: string): [string, string] {
  const m = p.match(/^([\s\S]{8,500}?:)\s*(?=[«“„"—–-])/)
  return m ? [m[1], p.slice(m[0].length)] : ['', p]
}

export function RuParas({ paras, hadith }: { paras: string[]; hadith?: boolean }) {
  const isHadith = hadith ?? NUM.test(paras[0] ?? '')
  let afterSource = false
  return (
    <div className="hd-ru">
      {paras.map((p, i) => {
        const num = p.match(NUM)
        const body = num ? p.slice(num[0].length) : p
        const badge = num && <span className="hd-n">{num[1]}</span>
        if (isSourcePara(body)) { afterSource = true; return <p key={i} className="hd-src">{bold(body)}</p> }
        if (!isHadith || afterSource) return <p key={i} className="hd-plain">{badge}{bold(body)}</p>
        // только вводные слова («…передают, что Пророк ﷺ сказал:»)
        if (/:$/.test(body.trim()) && body.length < 400) return <p key={i} className="hd-intro">{badge}{bold(body)}</p>
        const [intro, rest] = i === 0 || num ? splitIntro(body) : ['', body]
        // абзац заканчивается ссылкой на источник «(аль-Бухари 5673, Муслим 2816)» — дальше идёт комментарий
        if (SOURCE_END.test(rest)) afterSource = true
        // вводные слова — отдельной строкой, после пустой строки — сам текст хадиса
        return (
          <Fragment key={i}>
            {intro && <p className="hd-intro">{badge}{bold(intro)}</p>}
            <p className={'hd-text' + (intro ? ' after-intro' : '')}>{!intro && badge}{hadithText(rest)}</p>
          </Fragment>
        )
      })}
    </div>
  )
}

export function ArParas({ paras }: { paras: string[] }) {
  const font = useStore((s) => s.azFont) ?? 'sch'
  return (
    <div className="hd-ar" dir="rtl">
      {paras.map((p, i) => <p key={i}>{bold(arForFont(p, font))}</p>)}
    </div>
  )
}

/** «54. Поистине, правдивость…» → номер и заголовок; «1. Глава: О том…» / «Глава 1. О том…» → «Глава 1» и заголовок */
export function splitTitle(t: string): { no: string; title: string } {
  const g = t.match(/^Глава\s+(\d{1,4})\.\s*(.*)$/)
  if (g) return { no: `Глава ${g[1]}`, title: g[2] }
  const m = t.match(/^(\d{1,4})\.\s*(.*)$/)
  if (!m) return { no: '', title: t }
  const rest = m[2]
  if (!/^Глава(?![а-яё])/i.test(rest)) return { no: m[1], title: rest }
  // «Глава: О том…», «Глава. О том…», «Глава о том…» — слово «Глава» уходит в номер, название с большой буквы;
  // «Глава веры: …» — «Глава» здесь часть названия, оставляем целиком
  const h = rest.match(/^Глава(?:\s*[:.]\s*|\s+(?=(?:о|об|обо|про)\s)|\s*$)(.*)$/i)
  // «Глава: Глава о том…» — второе «Глава» тоже лишнее
  const title = h ? h[1].replace(/^Глава\s+(?=(?:о|об|обо|про)\s)/i, '') : rest
  return { no: `Глава ${m[1]}`, title: h ? cap(title) : rest }
}

/** Первая буква названия — заглавная (кавычки и скобки в начале пропускаем) */
const cap = (s: string) => s.replace(/^([«"„(\s]*)(\p{Ll})/u, (_, a: string, b: string) => a + b.toUpperCase())
