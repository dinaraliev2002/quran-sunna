import { useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useSpeech } from '../../hooks/useSpeech'
import { checkSpeech } from '../../lib/speechCheck'
import { haptic } from '../../lib/telegram'
import { useStore } from '../../store/settings'
import type { HifzItem } from '../../types/hifz'

/** Эталон: сам хадис; с передатчиком — ещё и слова до слов Пророка ﷺ («Я слышал, как… сказал») */
function referenceText(item: HifzItem, withNarrator: boolean) {
  const paras = item.ru.map((p, i) => (i === item.start[0] ? p.split(/\s+/).filter(Boolean).slice(withNarrator ? 0 : item.start[1]).join(' ') : p))
  return (withNarrator ? paras : paras.slice(item.start[0])).join(' ')
}

/** Сдача голосом: проговариваете хадис — приложение показывает пропущенное и ошибки (пока тест, без ИИ) */
export function VoiceCheck({ item }: { item: HifzItem }) {
  const pass = useStore((s) => s.hzVoicePass)
  const withNarr = useStore((s) => s.hzVoiceNarr)
  const set = useStore((s) => s.set)
  const { supported, listening, text, error, start, stop } = useSpeech()
  const [done, setDone] = useState(false)

  const result = useMemo(() => (done && text ? checkSpeech(referenceText(item, withNarr), text) : null), [done, text, item, withNarr])

  if (!supported) {
    return <p className="hz-tip">Проверка голосом пока недоступна в этом окне: распознавание речи не поддерживается. Попробуйте открыть приложение в обычном браузере.</p>
  }

  const toggle = () => {
    haptic.tap()
    if (listening) { stop(); setDone(true) } else { setDone(false); start() }
  }

  return (
    <div className="hz-voice">
      <button className="hz-voice-narr" onClick={() => set({ hzVoiceNarr: !withNarr })}>
        <span className={'switch' + (withNarr ? ' on' : '')} />Проверить и передатчика
      </button>
      <button className={'hz-voice-btn' + (listening ? ' rec' : '')} onClick={toggle}>
        <Icon id="mic" />{listening ? 'Готово — проверить' : done ? 'Сказать ещё раз' : 'Сказать вслух'}
      </button>
      {listening && <p className="hz-voice-live">{text || 'Говорите…'}</p>}
      {error && <p className="hz-voice-err">{error}</p>}
      {done && !listening && !text && !error && <p className="hz-voice-err">Ничего не услышал — попробуйте ещё раз.</p>}
      {result && (
        <div className="hz-voice-res">
          <div className={'hz-voice-pct' + (result.percent >= pass ? ' good' : '')}>
            <b>{result.percent}%</b>
            <span>{result.percent >= pass ? 'Выучено!' : `Нужно ${pass}%`}</span>
          </div>
          <p className="hz-voice-words">
            {result.words.map((w, i) => (
              <span key={i} className={'vw ' + w.state} title={w.said ? `Вы сказали: ${w.said}` : undefined}>{w.w} </span>
            ))}
          </p>
          <p className="hz-voice-sum">Верно: {result.ok} · ошибок: {result.wrong} · пропущено: {result.missed}{result.extra ? ` · лишних слов: ${result.extra}` : ''}</p>
        </div>
      )}
    </div>
  )
}
