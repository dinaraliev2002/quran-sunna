import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
import { plural } from '../../../lib/plural'
import { useStore } from '../../../store/settings'
import { useQhToday } from '../../../hooks/useQuranHifz'
// Итог урока

export function Finish({ mode, count }: { mode: 'learn' | 'review'; count: number }) {
  const nav = useNavigate()
  const { due, newLeft } = useQhToday()
  const markTask = useStore((s) => s.markTask)
  const nothingLeft = due.length === 0 && newLeft === 0
  useEffect(() => { if (nothingLeft && count) markTask('memo', true) }, [nothingLeft, count, markTask])
  return (
    <div className="nml-body nml-done">
      <div className="hz-done-ic"><Icon id="check" /></div>
      <b>{count === 0 ? (mode === 'review' ? 'Сегодня повторять нечего' : 'Этот отрывок уже учится') : mode === 'learn'
        ? 'Отрывок выучен — машаАллах!'
        : `Повторено ${count} ${plural(count, 'отрывок', 'отрывка', 'отрывков')}`}</b>
      <span>{mode === 'learn' && count ? 'Первый повтор — завтра. Приложение само напомнит в блоке «Сегодня».' : nothingLeft ? 'На сегодня всё. Следующие повторы появятся сами.' : ''}</span>
      {due.length > 0 && <button className="bigbtn" onClick={() => nav('/hifz/quran/review', { replace: true })}><Icon id="repeat" />Повторить · {due.length}</button>}
      {due.length === 0 && newLeft > 0 && <button className="bigbtn" onClick={() => nav('/hifz/quran/learn', { replace: true })}><Icon id="plus" />Учить дальше</button>}
      {nothingLeft && <button className="hz-again" onClick={() => nav('/hifz/quran/learn?n=' + useStore.getState().qhPerDay, { replace: true })}><Icon id="plus" />Выучить ещё</button>}
      <button className="hz-skip" onClick={() => nav('/hifz/quran', { replace: true })}>Готово</button>
    </div>
  )
}
