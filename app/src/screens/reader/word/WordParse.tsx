import { rootLetters, stemOf, tagValue, wordText } from '../../../lib/morph'
import { segChips, segRole } from '../../../lib/morphLabels'
import type { MorphWord } from '../../../types/morph'
import { VerbForms } from './VerbForms'

/** Вкладка «Разбор»: слово, перевод, корень и части слова с грамматикой */
export function WordParse({ word, tr }: { word: MorphWord; tr: string | null }) {
  const stem = stemOf(word)
  const root = stem && tagValue(stem, 'ROOT')
  const lemma = stem && tagValue(stem, 'LEM')
  return (
    <>
      <div className="wd-head">
        <div className="wd-ar ar" dir="rtl">{wordText(word)}</div>
        {tr && <div className="wd-tr">{tr}</div>}
      </div>
      {(root || lemma) && (
        <div className="wd-facts">
          {root && <div><span>Корень</span><b className="ar" dir="rtl">{rootLetters(root)}</b></div>}
          {lemma && <div><span>Исходная форма</span><b className="ar" dir="rtl">{lemma}</b></div>}
        </div>
      )}
      <div className="wd-sub">Из чего состоит слово</div>
      {word.map((seg, i) => (
        <div className="wd-seg" key={i}>
          <div className="ar" dir="rtl">{seg[0]}</div>
          <div>
            <b>{segRole(seg)}</b>
            {segChips(seg).length > 0 && <div className="wd-chips">{segChips(seg).map((c) => <span key={c}>{c}</span>)}</div>}
          </div>
        </div>
      ))}
      {stem && <VerbForms stem={stem} root={root || null} />}
    </>
  )
}
