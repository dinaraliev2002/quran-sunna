import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { TabBar } from '../../components/ui'
import { FreqTab } from './FreqTab'
import { GrammarTab } from './GrammarTab'
import { ConceptsTab } from './ConceptsTab'

/** «Слова Корана»: частые слова для заучивания и поиск по грамматике (на данных Quranic Arabic Corpus) */
export default function Words() {
  const nav = useNavigate()
  const concept = (useLocation().state as { concept?: string } | null)?.concept ?? null // пришли из аята: открыть это понятие
  const [tab, setTab] = useState<'freq' | 'grammar' | 'concepts'>(concept ? 'concepts' : 'freq')
  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>Слова Корана</b><span>Частота, грамматика, понятия</span></div>
        <span style={{ width: 44 }} />
      </div>
      <div className="wd-tabs">
        <button className={tab === 'freq' ? 'on' : ''} onClick={() => setTab('freq')}>Частые слова</button>
        <button className={tab === 'grammar' ? 'on' : ''} onClick={() => setTab('grammar')}>Грамматика</button>
        <button className={tab === 'concepts' ? 'on' : ''} onClick={() => setTab('concepts')}>Понятия</button>
      </div>
      {tab === 'freq' ? <FreqTab /> : tab === 'grammar' ? <GrammarTab /> : <ConceptsTab focus={concept} />}
      <p className="wd-src">Разбор слов — <a href="https://corpus.quran.com" target="_blank" rel="noreferrer">Quranic Arabic Corpus</a> (corpus.quran.com).</p>
      <TabBar />
    </div>
  )
}
