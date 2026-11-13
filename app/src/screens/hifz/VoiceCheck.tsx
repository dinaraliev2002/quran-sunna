import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { BARS, useSpeech } from '../../hooks/useSpeech'
import { checkSpeech } from '../../lib/speechCheck'
import { haptic } from '../../lib/telegram'
import { useStore } from '../../store/settings'
import type { HifzItem } from '../../types/hifz'

/** Эталон: сам хадис; с передатчиком — ещё и слова до слов Пророка ﷺ («Я слышал, как… сказал») */
function referenceText(item: HifzItem, withNarrator: boolean) {
  const paras = item.ru.map((p, i) => (i === item.start[0] ? p.split(/\s+/).filter(Boolean).slice(withNarrator ? 0 : item.start[1]).join(' ') : p))
  return (withNarrator ? paras : paras.slice(item.start[0])).join(' ')
}

/**
 * Запись голоса перед «Проверить себя»: пока идёт запись — только полоски громкости (текст не показываем),
 * результат сверки появляется уже после «Проверить себя» (VoiceResult).
 */
export function VoiceCheck({ onText }: { onText: (text: string) => void }) {
  const withNarr = useStore((s) => s.hzVoiceNarr)
  const set = useStore((s) => s.set)
  const { supported, listening, text, error, levels, metered, start, stop } = useSpeech()
  const [done, setDone] = useState(false)

  // после остановки отдаём распознанное наружу
  useEffect(() => { if (done && !listening) onText(text) }, [done, listening, text, onText])

  if (!supported) {
    return <p className="hz-tip">Проверка голосом пока недоступна в этом окне: распознавание речи не поддерживается. Попробуйте открыть приложение в обычном браузере.</p>
  }

  const toggle = () => {
    haptic.tap()
    if (listening) { stop(); setDone(true) } else { setDone(false); onText(''); start() }
  }
  const heard = done && !listening && !!text

  return (
    <div className="hz-voice">
      <button className="hz-voice-narr" onClick={() => set({ hzVoiceNarr: !withNarr })}>
        <span className={'switch' + (withNarr ? ' on' : '')} />Проверить и передатчика
      </button>
      <button className={'hz-voice-btn' + (listening ? ' rec' : '')} onClick={toggle}>
        <Icon id="mic" />{listening ? 'Закончить запись' : done ? 'Сказать ещё раз' : 'Сказать вслух'}
      </button>
      {listening && (
        <div className="hz-wave" aria-label="Идёт запись">
          {Array.from({ length: BARS }, (_, i) => (
            metered ? <i key={i} style={{ height: `${Math.max(6, levels[i] * 100)}%` }} /> : <i key={i} className="dot" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      )}
      {error && <p className="hz-voice-err">{error}</p>}
      {heard && <p className="hz-voice-ok"><Icon id="check" />Записано. Нажмите «Проверить себя» — увидите результат.</p>}
      {done && !listening && !text && !error && <p className="hz-voice-err">Ничего не услышал — попробуйте ещё раз.</p>}
    </div>
  )
}

/** Результат сверки — показывается на открытом тексте хадиса: что верно, где ошибка, что пропущено */
export function VoiceResult({ item, spoken }: { item: HifzItem; spoken: string }) {
  const pass = useStore((s) => s.hzVoicePass)
  const withNarr = useStore((s) => s.hzVoiceNarr)
  const r = useMemo(() => checkSpeech(referenceText(item, withNarr), spoken), [item, spoken, withNarr])
  const wrong = r.words.filter((w) => w.state === 'wrong')
  const missed = r.words.filter((w) => w.state === 'missed')
  const clean = (w: string) => w.replace(/[«»"“”.,;:!?()—–-]+/g, '')
  return (
    <div className="hz-voice-res">
      <div className={'hz-voice-pct' + (r.percent >= pass ? ' good' : '')}>
        <b>{r.percent}%</b>
        <span>{r.percent >= pass ? 'Выучено!' : `Нужно ${pass}%`}</span>
      </div>
      <p className="hz-voice-words">
        {r.words.map((w, i) => <span key={i} className={'vw ' + w.state}>{w.w} </span>)}
      </p>
      {wrong.length > 0 && (
        <div className="hz-voice-list">
          <b>Сказано неправильно</b>
          {wrong.map((w, i) => <p key={i}>«{w.said}» вместо «<span className="vw ok">{clean(w.w)}</span>»</p>)}
        </div>
      )}
      {missed.length > 0 && (
        <div className="hz-voice-list">
          <b>Пропущено</b>
          <p>{missed.map((w) => clean(w.w)).join(', ')}</p>
        </div>
      )}
      <p className="hz-voice-sum">Верно: {r.ok} · ошибок: {r.wrong} · пропущено: {r.missed}</p>
    </div>
  )
}
