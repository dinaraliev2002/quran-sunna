import { inDays, nextInterval } from '../../../lib/hifz'
import { type Grade } from '../../../types/hifz'
import { type QItem } from '../../../types/hifzQuran'
import { haptic } from '../../../lib/telegram'
import { useStore } from '../../../store/settings'
import { Tell } from './Tell'
// Повторение отрывка

export function ReviewItem({ item, onDone }: { item: QItem; onDone: () => void }) {
  const card = useStore((s) => s.qhifz[item.key])
  const grade = useStore((s) => s.qhGrade)
  const rate = (g: Grade) => { grade(item.key, g); if (g === 'good') haptic.success(); else haptic.tap(); onDone() }
  const btn = (g: Grade, label: string) => (
    <button className={'hz-grade ' + g} onClick={() => rate(g)}>
      <b>{label}</b><span>{inDays(nextInterval(card, g))}</span>
    </button>
  )
  return (
    <div className="nml-body">
      <Tell item={item} review>
        <div className="hz-grades">
          {btn('bad', 'Плохо')}
          {btn('mid', 'Средне')}
          {btn('good', 'Хорошо')}
        </div>
        <p className="hz-tip">«Плохо» — запинался или забыл: отрывок начнётся сначала. «Средне» — с ошибками: тот же срок ещё раз.</p>
      </Tell>
    </div>
  )
}
