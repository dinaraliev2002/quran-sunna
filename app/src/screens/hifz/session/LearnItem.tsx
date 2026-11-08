import { useMemo, useState } from 'react'
import { Icon } from '../../../components/Icon'
import { Tour } from '../../../components/Tour'
import { type QItem } from '../../../types/hifzQuran'
import { haptic } from '../../../lib/telegram'
import { usePlayer } from '../../../store/player'
import { useStore } from '../../../store/settings'
import { type Step, STEP_NAME, headWords } from './steps'
import { Ayahs } from './Ayahs'
import { Listen } from './Listen'
import { Tell } from './Tell'
import { useLead } from './useLead'
// Заучивание нового отрывка

export function LearnItem({ item, onDone }: { item: QItem; onDone: () => void }) {
  const drill = useStore((s) => s.qhDrill)
  const contNext = useStore((s) => s.qhNext)
  const learn = useStore((s) => s.qhLearn)
  const chain = useStore((s) => s.qhChain)
  const lead = useLead(item)
  const steps: Step[] = useMemo(() => {
    const d: Step[] = drill === 2 ? ['show2'] : drill === 3 ? ['show3'] : drill === 23 ? ['show2', 'show3'] : []
    return ['read', ...d, ...(contNext ? ['next'] as Step[] : []), 'tell']
  }, [drill, contNext])
  const [i, setI] = useState(0)
  // настройки поменяли посреди урока — не выходим за пределы шагов
  const step = steps[Math.min(i, steps.length - 1)]
  const go = (k: number) => { haptic.tap(); usePlayer.getState().stop(); setI(k); document.querySelector('.hz-s .nml-body')?.scrollTo(0, 0) }

  return (
    <div className="nml-body">
      <Tour id="hifz-quran-lesson" steps={[
        { el: '.hz-steps', title: 'Этапы урока', text: 'Слушать и читать → слова скрываются → по памяти. Можно вернуться назад кнопкой «Прочитать ещё».' },
        { el: '.icon-btn[aria-label="Настройки"]', title: 'Настройки урока', text: 'Сколько слов скрывать, пословный перевод, скорость чтеца от 0,5× до 1,5×, повтор каждого аята и прослушивание цепочкой.' },
      ]} />
      <div className="hz-steps">{steps.map((s, k) => <i key={s} className={k < i ? 'done' : k === i ? 'on' : ''} />)}</div>
      <div className="hz-step-name">{STEP_NAME[step]}</div>

      {step === 'read' && (
        <>
          {chain && lead && (
            <div className="hz-card qh-lead">
              <div className="qh-lead-l">Связка · последний аят прошлого отрывка</div>
              <Ayahs item={{ ...item, a: lead.n, b: lead.n, ayahs: [lead] }} />
            </div>
          )}
          <div className="hz-card"><Ayahs item={item} /></div>
          <Listen item={item} lead={lead} />
          <div className="hz-act">
            <button className="bigbtn" onClick={() => go(1)}><Icon id="check" />Прочитал</button>
          </div>
        </>
      )}

      {(step === 'show2' || step === 'show3' || step === 'next') && (
        <>
          <div className="hz-card"><Ayahs key={step} item={item} hide={step === 'next' ? (a, k) => k >= headWords(a.w.length) : (_, k) => k % (step === 'show2' ? 2 : 3) !== 0} /></div>
          <p className="hz-tip">{step === 'next'
            ? 'Видно только начало каждого аята — продолжите его по памяти. Нажмите на рамку, чтобы подсмотреть слово.'
            : 'Прочитайте отрывок, подставляя скрытые слова. Нажмите на рамку, чтобы подсмотреть слово.'}</p>
          <div className="hz-act">
            <button className="hz-skip" onClick={() => go(steps.indexOf('tell'))}>Пропустить упражнения</button>
            <button className="bigbtn" onClick={() => go(steps.indexOf(step) + 1)}>Дальше<Icon id="right" /></button>
          </div>
        </>
      )}

      {step === 'tell' && (
        <Tell item={item}>
          <div className="hz-act two">
            <button className="hz-again" onClick={() => go(0)}><Icon id="repeat" />Прочитать ещё</button>
            <button className="bigbtn" onClick={() => { learn(item.key); haptic.success(); onDone() }}><Icon id="check" />Запомнил</button>
          </div>
        </Tell>
      )}
    </div>
  )
}
