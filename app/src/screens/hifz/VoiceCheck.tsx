import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useVoice } from '../../hooks/useVoice'
import { BARS } from '../../hooks/useSpeech'
import { arSpan, arTokens } from '../../lib/arabicSpeech'
import { applyAccepted, checkSpeech, flaggedWords, type CheckResult, type VoiceLang } from '../../lib/speechCheck'
import { judgeWords, type VerifyItem } from '../../lib/voiceApi'
import { setVoiceContext } from '../../lib/voiceContext'
import { haptic } from '../../lib/telegram'
import { useStore } from '../../store/settings'
import { isVoiceLocked, useVoiceAccess } from '../../store/voiceAccess'
import { accessNote, VoicePaywall } from './VoicePaywall'
import type { HifzItem } from '../../types/hifz'

/** Эталон: сам хадис; с передатчиком — ещё и слова до слов Пророка ﷺ («Я слышал, как… сказал») */
export function referenceText(item: HifzItem, withNarrator: boolean, lang: VoiceLang = 'ru') {
  if (lang === 'ar') {
    const toks = arTokens(item.ar)
    const [a, b] = arSpan(toks, withNarrator, item.key[0] === 'n')
    return toks.slice(a, b).join(' ')
  }
  const paras = item.ru.map((p, i) => (i === item.start[0] ? p.split(/\s+/).filter(Boolean).slice(withNarrator ? 0 : item.start[1]).join(' ') : p))
  return (withNarrator ? paras : paras.slice(item.start[0])).join(' ')
}

/**
 * Запись голоса перед «Проверить себя»: пока идёт запись — только полоски громкости (текст не показываем),
 * результат сверки появляется уже после «Проверить себя» (VoiceResult).
 */
export function VoiceCheck({ onText, quran, hidden }: { onText: (text: string, verify?: VerifyItem[] | null) => void; quran?: boolean; hidden?: boolean }) {
  const withNarr = useStore((s) => s.hzVoiceNarr)
  const lang = useStore((s) => (quran ? 'ar' : s.hzVoiceLang))
  const set = useStore((s) => s.set)
  const { supported, listening, busy, text, verify, error, paywall, levels, metered, start, stop } = useVoice(quran ? 'ar' : undefined)
  const [done, setDone] = useState(false)
  // платный доступ: когда бесплатные проверки кончились и ничего не куплено — кнопка с замочком, по нажатию окно с тарифами
  const cloud = useStore((s) => s.hzVoiceEngine) === 'cloud'
  const locked = useVoiceAccess((a) => cloud && isVoiceLocked(a))
  const access = useVoiceAccess((a) => a.info)
  const [pay, setPay] = useState(false)
  useEffect(() => { if (cloud) void useVoiceAccess.getState().load() }, [cloud])
  useEffect(() => { if (paywall) setPay(true) }, [paywall])

  // после остановки отдаём распознанное наружу
  useEffect(() => { if (done && !listening && !busy) onText(text, verify) }, [done, listening, busy, text, verify, onText])

  // «Проверить себя» нажали, пока идёт запись: останавливаем её; пока идёт распознавание — компонент остаётся в окне (иначе результат потеряется)
  useEffect(() => { if (hidden && listening) { stop(); setDone(true) } }, [hidden, listening, stop])
  // по-арабски огласовки и буквы проверяет Gemini; если он не ответил (сбой, закончился баланс), проверены только слова — честно говорим об этом
  const noVowels = cloud && lang === 'ar' && done && !listening && !busy && !!text && verify === null
  const noVowelsNote = noVowels ? <p className="hz-voice-err">Огласовки в этот раз не проверены: сервис проверки огласовок не ответил. Проверены только слова и пропуски.</p> : null
  if (hidden) return busy ? <p className="hz-voice-ok">Распознаю речь… результат появится сам</p> : noVowelsNote

  if (!supported) {
    return <p className="hz-tip">Проверка голосом пока недоступна в этом окне: распознавание речи не поддерживается. Попробуйте открыть приложение в обычном браузере.</p>
  }

  const toggle = () => {
    haptic.tap()
    if (locked && !listening) { setPay(true); return }
    if (listening) { stop(); setDone(true) } else { setDone(false); onText(''); start() }
  }
  const heard = done && !listening && !busy && !!text

  return (
    <div className="hz-voice">
      {!quran && <div className="qh-chips hz-voice-lang" role="group" aria-label="Язык ответа">
        <button className={lang === 'ru' ? 'on' : ''} disabled={listening} onClick={() => { haptic.tick(); set({ hzVoiceLang: 'ru' }) }}>По-русски</button>
        <button className={lang === 'ar' ? 'on' : ''} disabled={listening} onClick={() => { haptic.tick(); set({ hzVoiceLang: 'ar' }) }}>По-арабски</button>
      </div>}
      {!quran && <button className="hz-voice-narr" onClick={() => set({ hzVoiceNarr: !withNarr })}>
        <span className={'switch' + (withNarr ? ' on' : '')} />Проверить и передатчика
      </button>}
      {!listening && !done && <p className="hz-voice-hint">Говорите чётко и не спеша, в тихом месте, ближе к микрофону — так меньше ошибок распознавания.{lang === 'ar' ? ' По-арабски проверяются слова и пропуски; огласовки (харакаты) — если включено в настройках и распознавание их пишет.' : ''}</p>}
      {cloud && !locked && <p className="hz-voice-left">{accessNote(access)}</p>}
      <button className={'hz-voice-btn' + (listening ? ' rec' : '') + (locked ? ' locked' : '')} onClick={toggle}>
        <Icon id={locked ? 'lock' : 'mic'} />{listening ? 'Закончить запись' : done ? 'Сказать ещё раз' : 'Сказать вслух'}
      </button>
      {listening && (
        <div className="hz-wave" aria-label="Идёт запись">
          {Array.from({ length: BARS }, (_, i) => (
            metered ? <i key={i} style={{ height: `${Math.max(6, levels[i] * 100)}%` }} /> : <i key={i} className="dot" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      )}
      {busy && <p className="hz-voice-ok">Распознаю речь…</p>}
      {error && <p className="hz-voice-err">{error}</p>}
      {heard && <p className="hz-voice-ok"><Icon id="check" />Записано. Нажмите «Проверить себя» — увидите результат.</p>}
      {noVowelsNote}
      {done && !listening && !busy && !text && !error && <p className="hz-voice-err">Ничего не услышал — попробуйте ещё раз.</p>}
      {pay && <VoicePaywall onClose={() => setPay(false)} />}
    </div>
  )
}

/** Сверка сказанного с хадисом (с учётом настроек) */
export function useVoiceResult(item: HifzItem, spoken: string, verify: VerifyItem[] | null = null): { r: CheckResult | null; checking: boolean } {
  const withNarr = useStore((s) => s.hzVoiceNarr)
  const lang = useStore((s) => s.hzVoiceLang)
  const ref = useMemo(() => referenceText(item, withNarr, lang), [item, withNarr, lang])
  return useVoiceCheck(ref, lang, spoken, verify, `${item.key} · ${item.src}`)
}

/** Ядро сверки: спорные слова сразу показываются как ошибки, затем ИИ (если включён) засчитывает те, что ошибкой не являются */
export function useVoiceCheck(ref: string, lang: VoiceLang, spoken: string, verify: VerifyItem[] | null = null, label = ''): { r: CheckResult | null; checking: boolean } {
  useEffect(() => { setVoiceContext({ ref, label }) }, [ref, label]) // для сохранения записи (если разрешено)
  const loose = useStore((s) => s.hzVoiceLoose)
  const ai = useStore((s) => s.hzVoiceAi)
  const harakat = useStore((s) => s.hzHarakat)
  const base = useMemo(() => (spoken && ref ? checkSpeech(ref, spoken, !loose, lang, harakat, verify) : null), [ref, spoken, loose, lang, harakat, verify])
  const [accepted, setAccepted] = useState<{ key: string; idx: number[] } | null>(null)
  const [checking, setChecking] = useState(false)
  const key = `${ref}|${spoken}|${JSON.stringify(verify)}|${loose}|${lang}|${harakat}`
  const last = useRef('')
  useEffect(() => {
    if (!ai || !base || !base.relevant) { setChecking(false); return }
    const flagged = flaggedWords(base)
    if (!flagged.length || last.current === key) return
    last.current = key
    setChecking(true)
    judgeWords(ref, spoken, flagged, false, lang)
      .then((idx) => setAccepted({ key, idx }))
      .catch(() => setAccepted({ key, idx: [] })) // ИИ недоступен — остаётся обычная сверка
      .finally(() => setChecking(false))
  }, [ai, base, key, ref, spoken, lang])
  const r = useMemo(() => (base && ai && accepted?.key === key ? applyAccepted(base, accepted.idx) : base), [base, ai, accepted, key])
  return { r, checking: ai && checking }
}

const clean = (w: string) => w.replace(/[«»"“”.,;:!?()—–-]+/g, '')

/** Процент — над текстом хадиса */
export function VoiceScore({ r, checking }: { r: CheckResult; checking?: boolean }) {
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
      {checking && <p className="hz-voice-sum">ИИ проверяет спорные слова…</p>}
      {r.words.some((w) => w.ai) && <p className="hz-voice-sum">ИИ засчитал слов: {r.words.filter((w) => w.ai).length} (в тексте они подчёркнуты точками) — это перестановка или ошибка распознавания, а не ошибка.</p>}
      {r.wrong + r.missed > 0 && <p className="hz-voice-sum">Ошибки подсвечены в тексте — нажмите на слово, чтобы увидеть, что вы сказали.</p>}
    </div>
  )
}

/** Что сказано неправильно и что пропущено — под текстом хадиса */
export function VoiceErrors({ r, spoken }: { r: CheckResult; spoken: string }) {
  const engine = useStore((s) => s.hzVoiceEngine)
  const wrong = r.words.filter((w) => w.state === 'wrong')
  const missed = r.words.filter((w) => w.state === 'missed')
  if (!r.relevant || wrong.length + missed.length === 0) return null
  return (
    <div className="hz-voice-res below">
      <details className="hz-voice-heard">
        <summary>Как вас услышало приложение ({engine === 'cloud' ? 'облачное' : 'системное'} распознавание)</summary>
        <p>{spoken || '—'}</p>
      </details>
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
