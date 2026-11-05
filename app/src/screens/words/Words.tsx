import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { FreqTab } from './FreqTab'
import { GrammarTab } from './GrammarTab'
import { ConceptsTab } from './ConceptsTab'
import { TopicsTab } from './TopicsTab'

const TABS = [['freq', 'Частые слова'], ['grammar', 'Грамматика'], ['concepts', 'Понятия'], ['topics', 'Темы']] as const

/** «Слова Корана»: частые слова, поиск по грамматике и понятия (на данных Quranic Arabic Corpus) */
export default function Words() {
  const nav = useNavigate()
  const state = useLocation().state as { concept?: string; topic?: number } | null
  const concept = state?.concept ?? null // пришли из аята или слова: открыть это понятие
  const topic = state?.topic ?? null // или эту тему
  const [tab, setTab] = useState<(typeof TABS)[number][0]>(topic ? 'topics' : concept ? 'concepts' : 'freq')
  const [fold, setFold] = useState(false) // свёрнуты ли вкладки под названием
  return (
    <div className="screen words">
      <div className="words-head">
        <div className="topbar">
          <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
          <div className="ttl"><b>Слова Корана</b><span>Частота, грамматика, понятия, темы</span></div>
          <button className={'icon-btn fold' + (fold ? ' on' : '')} onClick={() => setFold(!fold)} aria-label={fold ? 'Показать разделы' : 'Свернуть разделы'} aria-expanded={!fold}><Icon id="down" /></button>
        </div>
        {!fold && (
          <div className="wd-tabs">
            {TABS.map(([id, label]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
          </div>
        )}
      </div>
      {tab === 'freq' ? <FreqTab /> : tab === 'grammar' ? <GrammarTab /> : tab === 'concepts' ? <ConceptsTab focus={concept} /> : <TopicsTab focus={topic} />}
      <p className="wd-src">Разбор слов — <a href="https://corpus.quran.com" target="_blank" rel="noreferrer">Quranic Arabic Corpus</a> (corpus.quran.com).</p>
    </div>
  )
}
