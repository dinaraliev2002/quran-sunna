import { Sheet, SheetHead } from '../../../components/ui'
import { haptic } from '../../../lib/telegram'
import { useStore } from '../../../store/settings'
import { type Settings } from '../../../types/settings'
import { PAUSES, RATES, rateL } from './steps'
import { RepeatPick } from './RepeatPick'

/** Шестерёнка урока: упражнения, перевод, чтец */
export function GearSheet({ onClose }: { onClose: () => void }) {
  const st = useStore()
  const chip = <T,>(v: T, cur: T, label: string, apply: (v: T) => void) => (
    <button key={label} className={cur === v ? 'on' : ''} onClick={() => { haptic.tick(); apply(v) }}>{label}</button>
  )
  const sw = (on: boolean, t: string, sub: string, toggle: () => void) => (
    <button className="qh-sw" onClick={() => { haptic.tick(); toggle() }}>
      <span className="t">{t}<small>{sub}</small></span>
      <span className={'switch' + (on ? ' on' : '')} />
    </button>
  )
  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="Настройки заучивания" onClose={onClose} />
      <div className="body qh-set">
        <div>
          <div className="qh-set-l">Упражнение<small>Сколько слов видно перед чтением по памяти</small></div>
          <div className="qh-chips">
            {chip<Settings['qhDrill']>(3, st.qhDrill, 'Через два', (v) => st.set({ qhDrill: v }))}
            {chip<Settings['qhDrill']>(2, st.qhDrill, 'Через одно', (v) => st.set({ qhDrill: v }))}
            {chip<Settings['qhDrill']>(23, st.qhDrill, 'Сначала через одно, потом через два', (v) => st.set({ qhDrill: v }))}
            {chip<Settings['qhDrill']>(0, st.qhDrill, 'Без упражнений', (v) => st.set({ qhDrill: v }))}
          </div>
        </div>
        {sw(st.qhCheckAudio, 'Звук при проверке', 'По кнопке «Проверить себя» сразу звучат аяты отрывка', () => st.set({ qhCheckAudio: !st.qhCheckAudio }))}
        {sw(st.qhNext, '«Продолжи аят»', 'Ещё упражнение: видно только начало каждого аята', () => st.set({ qhNext: !st.qhNext }))}
        <div>
          <div className="qh-set-l">Перевод</div>
          <div className="qh-chips">
            {chip(true, st.qhWbw, 'Пословный и обычный', (v) => st.set({ qhWbw: v }))}
            {chip(false, st.qhWbw, 'Только обычный', (v) => st.set({ qhWbw: v }))}
          </div>
        </div>
        <div>
          <div className="qh-set-l">Скорость чтеца</div>
          <div className="qh-chips">{RATES.map((r) => chip(r, st.qhRate, rateL(r), (v) => st.set({ qhRate: v })))}</div>
        </div>
        <div>
          <div className="qh-set-l">Каждый аят при прослушивании</div>
          <RepeatPick value={st.qhRepeat} onChange={(v) => st.set({ qhRepeat: v })} />
        </div>
        <div>
          <div className="qh-set-l">Весь отрывок при прослушивании<small>Сколько раз подряд прослушать все аяты отрывка целиком</small></div>
          <RepeatPick value={st.qhRepeatAll} onChange={(v) => st.set({ qhRepeatAll: v })} />
        </div>
        <div>
          <div className="qh-set-l">Пауза между повторами<small>Перед повтором аята и перед новым кругом — время вдохнуть и повторить за чтецом</small></div>
          <div className="qh-chips">{PAUSES.map((n) => chip(n, st.qhPause, n ? `${n} с` : 'Без паузы', (v) => st.set({ qhPause: v })))}</div>
        </div>
        {sw(st.qhChain, 'Слушать цепочкой', 'Последний аят прошлого отрывка переносится в новый: вчера 1–5, сегодня 5, 6–10. Так новое связывается с выученным', () => st.set({ qhChain: !st.qhChain }))}
      </div>
    </Sheet>
  )
}
