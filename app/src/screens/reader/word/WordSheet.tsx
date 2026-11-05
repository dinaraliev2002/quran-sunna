import { useState } from 'react'
import { Sheet, SheetHead } from '../../../components/ui'
import { useQuranMeta } from '../../../hooks/useQuranMeta'
import { useWordData } from '../../../hooks/useWordData'
import { stemOf, tagValue } from '../../../lib/morph'
import { useWordSheet } from '../../../store/wordSheet'
import type { WordTarget } from '../../../types/morph'
import { WordParse } from './WordParse'
import { FormsTab, WhereTab } from './WordRoot'
import { RoleTab } from './WordRole'

const TABS = [['parse', 'Разбор'], ['role', 'Роль'], ['where', 'Где ещё'], ['forms', 'Формы']] as const

/** Окно разбора слова: открывается из режимов «Мусхаф» и «Слова с переводом» */
export function WordSheet() {
  const target = useWordSheet((s) => s.target)
  const close = useWordSheet((s) => s.close)
  return target ? <WordSheetBody key={`${target.s}:${target.a}:${target.w}`} target={target} onClose={close} /> : null
}

function WordSheetBody({ target, onClose }: { target: WordTarget; onClose: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('parse')
  const meta = useQuranMeta()
  const { word, tr } = useWordData(target)
  const stem = word ? stemOf(word) : null
  const root = stem ? tagValue(stem, 'ROOT') : null
  const name = meta?.surahs[target.s - 1]?.name ?? ''
  return (
    <Sheet tall onClose={onClose}>
      <SheetHead title="Разбор слова" sub={`${name} · ${target.s}:${target.a} · слово ${target.w}`} onClose={onClose} />
      <div className="wd-tabs">
        {TABS.map(([id, label]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      <div className="wd-body">
        {word === undefined && <div className="loading">Загрузка…</div>}
        {word === null && <p className="wd-note">Для этого слова нет разбора.</p>}
        {word && tab === 'parse' && <WordParse word={word} tr={tr} />}
        {word && tab === 'role' && <RoleTab target={target} word={word} />}
        {word && tab === 'where' && <WhereTab root={root} />}
        {word && tab === 'forms' && <FormsTab root={root} />}
      </div>
      <p className="wd-src">
        {tab === 'role'
          ? <>Роли слов — <a href="https://github.com/NoorBayan/Quranic" target="_blank" rel="noreferrer">The Quranic Treebank</a> (NoorBayan, лицензия MIT).</>
          : <>Грамматический разбор — <a href="https://corpus.quran.com" target="_blank" rel="noreferrer">Quranic Arabic Corpus</a> (corpus.quran.com).</>}
      </p>
    </Sheet>
  )
}
