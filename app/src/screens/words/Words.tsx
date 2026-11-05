import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { FreqTab } from './FreqTab'
import { GrammarTab } from './GrammarTab'
import { ConceptsTab } from './ConceptsTab'
import { TopicsTab } from './TopicsTab'

type Tab = 'freq' | 'grammar' | 'concepts' | 'topics'
const SECTIONS = {
  words: { title: 'Слова Корана', sub: 'Частота и грамматика', tabs: [['freq', 'Частые слова'], ['grammar', 'Грамматика']] as [Tab, string][] },
  meaning: { title: 'Смысл Корана', sub: 'Понятия и темы', tabs: [['topics', 'Темы'], ['concepts', 'Понятия']] as [Tab, string][] },
}

/** «Слова Корана» (частые слова, грамматика) и «Смысл Корана» (темы, понятия) — на данных Quranic Arabic Corpus и QUL */
export default function Words({ section }: { section: 'words' | 'meaning' }) {
  const nav = useNavigate()
  const sec = SECTIONS[section]
  const state = useLocation().state as { concept?: string; topic?: number } | null
  const concept = state?.concept ?? null // пришли из аята или слова: открыть это понятие
  const topic = state?.topic ?? null // или эту тему
  const [tab, setTab] = useState<Tab>(section === 'words' ? 'freq' : concept ? 'concepts' : 'topics')
  const [fold, setFold] = useState(false) // свёрнуты ли вкладки под названием
  return (
    <div className="screen words">
      <div className="words-head">
        <div className="topbar">
          <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
          <div className="ttl"><b>{sec.title}</b><span>{sec.sub}</span></div>
          <button className={'icon-btn fold' + (fold ? ' on' : '')} onClick={() => setFold(!fold)} aria-label={fold ? 'Показать разделы' : 'Свернуть разделы'} aria-expanded={!fold}><Icon id="down" /></button>
        </div>
        {!fold && (
          <div className="wd-tabs">
            {sec.tabs.map(([id, label]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
          </div>
        )}
      </div>
      {tab === 'freq' ? <FreqTab /> : tab === 'grammar' ? <GrammarTab /> : tab === 'concepts' ? <ConceptsTab focus={concept} /> : <TopicsTab focus={topic} />}
      <p className="wd-src">
        {section === 'words'
          ? <>Разбор слов — <a href="https://corpus.quran.com" target="_blank" rel="noreferrer">Quranic Arabic Corpus</a> (corpus.quran.com).</>
          : <>Понятия и темы — <a href="https://corpus.quran.com" target="_blank" rel="noreferrer">Quranic Arabic Corpus</a> и <a href="https://qul.tarteel.ai" target="_blank" rel="noreferrer">Quranic Universal Library</a>.</>}
      </p>
    </div>
  )
}
