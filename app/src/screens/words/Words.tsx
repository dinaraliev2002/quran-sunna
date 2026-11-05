import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { TabBar } from '../../components/ui'
import { FreqTab } from './FreqTab'
import { GrammarTab } from './GrammarTab'

/** «Слова Корана»: частые слова для заучивания и поиск по грамматике (на данных Quranic Arabic Corpus) */
export default function Words() {
  const nav = useNavigate()
  const [tab, setTab] = useState<'freq' | 'grammar'>('freq')
  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>Слова Корана</b><span>Частота и грамматика</span></div>
        <span style={{ width: 44 }} />
      </div>
      <div className="wd-tabs">
        <button className={tab === 'freq' ? 'on' : ''} onClick={() => setTab('freq')}>Частые слова</button>
        <button className={tab === 'grammar' ? 'on' : ''} onClick={() => setTab('grammar')}>Поиск по грамматике</button>
      </div>
      {tab === 'freq' ? <FreqTab /> : <GrammarTab />}
      <p className="wd-src">Разбор слов — <a href="https://corpus.quran.com" target="_blank" rel="noreferrer">Quranic Arabic Corpus</a> (corpus.quran.com).</p>
      <TabBar />
    </div>
  )
}
