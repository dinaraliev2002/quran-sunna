import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
import { Sheet } from '../../../components/ui'
import { loadSurah, loadTafsir, tafsirFor, type Ayah, type Surah } from '../../../lib/data'
import { haptic } from '../../../lib/telegram'
import { useStore } from '../../../store/settings'
import { QpcText } from '../views'
import { TafsirText } from '../TafsirText'
import { AsbabBlock } from '../Asbab'
import { KulievBlock, SajdaBlock } from '../Kuliev'
import { LearnMenu } from './LearnMenu'
import { TRANSLATIONS } from './translations'
import { useScrollThumb } from '../../../hooks/useScrollThumb'

/** Окно аята: арабский текст, перевод, тафсир ас-Саади. Листается свайпом влево/вправо по аятам. */
export function AyahSheet({ surah, ayah, onClose, onPlay, onAyah }: {
  surah: Surah; ayah: number; onClose: () => void; onPlay: (s: number, a: number) => void
  /** аят сменился (листают тафсир) — чтобы страница под окном перелистнулась следом */
  onAyah?: (s: number, a: number, page: number) => void
}) {
  const st = useStore()
  const [ayahs, setAyahs] = useState<Ayah[] | null>(null)
  const [tf, setTf] = useState<Record<string, string> | null | undefined>(undefined)
  const [cur, setCur] = useState(ayah)
  const [slide, setSlide] = useState<'' | 'l' | 'r'>('')
  const bodyRef = useRef<HTMLDivElement>(null)
  const [learnMenu, setLearnMenu] = useState(false)
  const learnPress = useRef<ReturnType<typeof setTimeout>>(undefined)
  const learnLong = useRef(false)
  useEffect(() => {
    loadSurah(surah.id).then(setAyahs)
    loadTafsir(surah.id).then(setTf).catch(() => setTf(null))
  }, [surah])

  const a = ayahs?.[cur - 1]
  const t = tf ? tafsirFor(tf, cur, surah.ayahs) : null
  // перешли на другую страницу мусхафа — заметная вибрация и перелистывание страницы под окном
  const lastPage = useRef<number | null>(null)
  useEffect(() => {
    if (!a) return
    const first = lastPage.current === null
    if (!first && lastPage.current !== a.p) haptic.page('quran')
    lastPage.current = a.p
    if (!first) onAyah?.(surah.id, cur, a.p) // при открытии окна текст под ним не двигаем
  }, [a])
  const key = `${surah.id}:${cur}`
  const marked = st.bookmarks.includes(key)
  const nav = useNavigate()
  const go = (n: number, dir: 'l' | 'r') => {
    if (n < 1 || n > surah.ayahs) return
    setSlide(dir); setCur(n)
    bodyRef.current?.scrollTo({ top: 0 })
    setTimeout(() => setSlide(''), 250)
  }
  const goRef = useRef({ next: () => {}, prev: () => {} })
  goRef.current = { next: () => go(cur + 1, 'l'), prev: () => go(cur - 1, 'r') }

  // свайп влево — следующий аят, вправо — предыдущий
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    let x = 0, y = 0
    const s = (e: TouchEvent) => { x = e.touches[0].clientX; y = e.touches[0].clientY }
    const end = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - x, dy = e.changedTouches[0].clientY - y
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? goRef.current.next() : goRef.current.prev())
    }
    el.addEventListener('touchstart', s, { passive: true })
    el.addEventListener('touchend', end)
    return () => { el.removeEventListener('touchstart', s); el.removeEventListener('touchend', end) }
  }, [])

  const range = t ? (t.from === t.to ? `аят ${t.from}` : `аяты ${t.from}–${t.to}`) : ''

  // полоска прокрутки справа (t пересоздаётся на каждой отрисовке — его в зависимости не берём)
  const { bar, barRef, thumbRef, onScroll: onBodyScroll } = useScrollThumb(bodyRef, [a, tf, cur])
  return (
    <Sheet onClose={onClose} tall>
      <div className="sh">
        <div><h3>{surah.name}, аят {cur}</h3><span>{surah.meaning} · {cur} из {surah.ayahs}{a ? ` · стр. ${a.p}` : ''}</span></div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="xbtn" disabled={cur <= 1} style={{ opacity: cur > 1 ? 1 : .35 }} onClick={() => go(cur - 1, 'r')} aria-label="Предыдущий аят"><Icon id="back" /></button>
          <button className="xbtn" disabled={cur >= surah.ayahs} style={{ opacity: cur < surah.ayahs ? 1 : .35 }} onClick={() => go(cur + 1, 'l')} aria-label="Следующий аят"><Icon id="right" /></button>
          <button className="xbtn" onClick={onClose} aria-label="Закрыть"><Icon id="close" /></button>
        </div>
      </div>
      {bar && (
        <div className="scrollbar" ref={barRef} style={{ top: bar.areaTop, height: bar.areaH }} aria-hidden>
          <i ref={thumbRef} style={{ height: bar.h }} />
        </div>
      )}
      <div className="body" ref={bodyRef} onScroll={onBodyScroll}>
        {!a && <div className="loading">Загрузка…</div>}
        {a && (
          <div key={cur} className={'ayah-sheet' + (slide ? ' slide-' + slide : '')}>
            <QpcText page={a.p} glyphs={a.g} tajweed={st.tajweed} className="as-ar" />
            <div className="as-actions">
              <button onClick={() => onPlay(surah.id, cur)}><Icon id="play" />Слушать</button>
              <button className={marked ? 'on' : ''} onClick={() => { haptic.tap(); st.toggleBookmark(key) }}><Icon id="bookmark" />{marked ? 'В закладках' : 'В закладки'}</button>
              {/* нажатие — учить с этого аята; долгое — выбрать: учить сейчас или добавить в «Мой набор» */}
              <button
                onPointerDown={() => { learnLong.current = false; clearTimeout(learnPress.current); learnPress.current = setTimeout(() => { learnLong.current = true; haptic.tap(); setLearnMenu(true) }, 450) }}
                onPointerUp={() => clearTimeout(learnPress.current)} onPointerLeave={() => clearTimeout(learnPress.current)} onPointerCancel={() => clearTimeout(learnPress.current)}
                onContextMenu={(e) => { e.preventDefault(); setLearnMenu(true) }}
                onClick={() => { if (learnLong.current) return; haptic.tap(); nav(`/hifz/quran/learn?s=${surah.id}&a=${cur}`) }}><Icon id="brain" />Учить</button>
            </div>
            <div className="as-label">Перевод · {TRANSLATIONS[st.translation]}</div>
            <div className="as-tr">{st.translation === 'aa' ? a.aa : a.ku}</div>
            <AsbabBlock key={key} surah={surah.id} ayah={cur} />
            <SajdaBlock key={'sj' + key} surah={surah.id} ayah={cur} />
            <KulievBlock key={'kv' + key} surah={surah.id} ayah={cur} />
            <div className="as-label">Тафсир ас-Саади{range ? ` · ${range}` : ''}</div>
            {tf === undefined && <div className="loading" style={{ height: 80 }}>Загрузка…</div>}
            {tf !== undefined && !t && <div className="empty">Для этого аята тафсир не найден</div>}
            {t && <TafsirText text={t.text} />}
            <div className="tafsir-hint">Свайп влево — следующий аят, вправо — предыдущий</div>
          </div>
        )}
      </div>
      {learnMenu && <LearnMenu surah={surah} ayah={cur} onClose={() => setLearnMenu(false)} />}
    </Sheet>
  )
}
