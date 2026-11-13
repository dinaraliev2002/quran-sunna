import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { BARS, useSpeech } from '../../hooks/useSpeech'
import { checkSpeech, type CheckResult } from '../../lib/speechCheck'
import { haptic } from '../../lib/telegram'
import { useStore } from '../../store/settings'
import type { HifzItem } from '../../types/hifz'

/** Эталон: сам хадис; с передатчиком — ещё и слова до слов Пророка ﷺ («Я слышал, как… сказал») */
export function referenceText(item: HifzItem, withNarrator: boolean) {
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
      {!listening && !done && <p className="hz-voice-hint">Говорите чётко и не спеша, в тихом месте, ближе к микрофону — так меньше ошибок распознавания.</p>}
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

/** Сверка сказанного с хадисом (с учётом настроек); null — если ничего не говорили */
export function useVoiceResult(item: HifzItem, spoken: string): CheckResult | null {
  const withNarr = useStore((s) => s.hzVoiceNarr)
  const loose = useStore((s) => s.hzVoiceLoose)
  return useMemo(() => (spoken ? checkSpeech(referenceText(item, withNarr), spoken, !loose) : null), [item, spoken, withNarr, loose])
}

const clean = (w: string) => w.replace(/[«»"“”.,;:!?()—–-]+/g, '')

/** Процент — над текстом хадиса */
export function VoiceScore({ r }: { r: CheckResult }) {
  const pass = useStore((s) => s.hzVoicePass)
  if (!r.relevant) {
    return (
      <div className="hz-voice-res">
        <div className="hz-voice-pct"><b>0%</b><span>Не похоже на этот хадис</span></div>
        <p className="hz-voice-sum">Сказанное почти не совпало с текстом хадиса — возможно, запись была не про него или микрофон не расслышал. Попробуйте ещё раз.</p>
      </div>
    )
  }
  return (
    <div className="hz-voice-res">
      <div className={'hz-voice-pct' + (r.percent >= pass ? ' good' : '')}>
        <b>{r.percent}%</b>
        <span>{r.percent >= pass ? 'Выучено!' : `Нужно ${pass}%`}</span>
      </div>
      {r.wrong + r.missed > 0 && <p className="hz-voice-sum">Ошибки подсвечены в тексте — нажмите на слово, чтобы увидеть, что вы сказали.</p>}
    </div>
  )
}

/** Что сказано неправильно и что пропущено — под текстом хадиса */
export function VoiceErrors({ r }: { r: CheckResult }) {
  const wrong = r.words.filter((w) => w.state === 'wrong')
  const missed = r.words.filter((w) => w.state === 'missed')
  if (!r.relevant || wrong.length + missed.length === 0) return null
  return (
    <div className="hz-voice-res below">
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
