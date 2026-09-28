import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Sheet, SheetHead, TabBar, useQuranMeta } from '../components/ui'
import { appleWebKit, fontVariant } from '../lib/fonts'
import { storageUsage } from '../lib/idb'
import { cancelDownload, deleteDownloads, downloadAudio, downloadData, downloadFonts, offlineStatus, useDownloads } from '../lib/offline'
import { RECITERS } from '../store/player'
import { useStore } from '../store/settings'
import { useUi } from '../store/ui'

type Status = Awaited<ReturnType<typeof offlineStatus>>
const mb = (bytes: number) => (bytes >= 1e9 ? (bytes / 1e9).toFixed(1) + ' ГБ' : Math.round(bytes / 1e6) + ' МБ')

export default function Downloads() {
  const nav = useNavigate()
  const meta = useQuranMeta()
  const { tajweed, reciter } = useStore()
  const theme = useUi((s) => s.theme)
  const { job, version } = useDownloads()
  const [status, setStatus] = useState<Status | null>(null)
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null)
  const [pickSurahs, setPickSurahs] = useState(false)
  const variant = fontVariant(tajweed, theme)
  const recName = (RECITERS[reciter] ?? RECITERS.alafasy).name

  useEffect(() => {
    offlineStatus(variant, reciter).then(setStatus)
    storageUsage().then(setUsage)
  }, [variant, reciter, version, job?.done === job?.total])

  const fontsSize = variant === 'v2' ? '≈ 60 МБ' : variant === 'v4c' ? '≈ 50 МБ' : '≈ 190 МБ'
  const busy = !!job

  const Progress = ({ id }: { id: string }) =>
    job?.id === id ? (
      <div className="dl-progress">
        <div className="bar2"><i style={{ width: `${(job.done / Math.max(1, job.total)) * 100}%` }} /></div>
        <div className="dl-row"><span>{job.done} из {job.total}{job.failed ? ` · ошибок ${job.failed}` : ''}</span><button className="dl-link" onClick={cancelDownload}>Отменить</button></div>
      </div>
    ) : null

  const Card = ({ icon, title, sub, done, total, id, onDownload, onDelete, children }: {
    icon: string; title: string; sub: string; done: number; total: number; id: string
    onDownload: () => void; onDelete?: () => void; children?: ReactNode
  }) => {
    const complete = total > 0 && done >= total
    return (
      <div className="dl-card">
        <div className="dl-head">
          <span className="dl-ic"><Icon id={icon} /></span>
          <div className="t"><b>{title}</b><span>{sub}</span></div>
          {complete ? <span className="dl-ok"><Icon id="check" /></span> : null}
        </div>
        {job?.id === id ? <Progress id={id} /> : (
          <>
            {!complete && done > 0 && <div className="bar2"><i style={{ width: `${(done / total) * 100}%` }} /></div>}
            <div className="dl-row">
              <span>{complete ? 'Скачано полностью' : done ? `Скачано ${done} из ${total}` : 'Не скачано'}</span>
              <div style={{ display: 'flex', gap: 12 }}>
                {onDelete && done > 0 && <button className="dl-link danger" disabled={busy} onClick={onDelete}>Удалить</button>}
                {!complete && <button className="dl-link" disabled={busy} onClick={onDownload}>{done ? 'Докачать' : 'Скачать'}</button>}
              </div>
            </div>
          </>
        )}
        {children}
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>Загрузки</b><span>Работа без интернета</span></div>
        <span style={{ width: 44 }} />
      </div>
      <p className="dl-note">
        То, что вы открывали, уже сохраняется на телефоне само. Здесь можно скачать всё заранее —
        тогда суры и страницы открываются мгновенно, а чтец звучит без интернета.
      </p>

      {!status && <div className="loading">Проверяю…</div>}
      {status && (
        <>
          <Card icon="book" id="data" title="Текст Корана" sub="Аяты, 2 перевода, тафсир, раскладка страниц · ≈ 23 МБ"
            done={status.data.done} total={status.data.total} onDownload={downloadData} />
          <Card icon="open" id={'fonts:' + variant} title="Страницы мусхафа"
            sub={`Шрифты 604 страниц ${tajweed ? 'с таджвидом' : 'без таджвида'}${appleWebKit && tajweed ? (theme === 'dark' ? ' (тёмная тема)' : ' (светлая тема)') : ''} · ${fontsSize}`}
            done={status.fonts.done} total={status.fonts.total} onDownload={() => downloadFonts(variant)} onDelete={() => deleteDownloads('fonts', variant)} />
          <Card icon="sound" id={'audio:' + reciter} title={`Аудио · ${recName}`} sub="Весь Коран по аятам · ≈ 0,7–1 ГБ"
            done={status.audio.done} total={status.audio.total}
            onDownload={() => meta && downloadAudio(reciter, meta.surahs, 'Весь Коран')} onDelete={() => deleteDownloads('audio', reciter)}>
            <button className="srow2" style={{ marginTop: 10, marginBottom: 0 }} disabled={busy} onClick={() => setPickSurahs(true)}>
              <div>Скачать отдельные суры<span>Скачано полностью: {status.audio.fullSurahs.length} из 114</span></div><Icon id="right" className="icon" />
            </button>
          </Card>
          <p className="dl-note small">
            Чтеца можно сменить в настройках — у каждого чтеца свои загрузки.
            {appleWebKit && tajweed && ' На iPhone для светлой и тёмной темы — разные файлы страниц с таджвидом.'}
          </p>
          {usage && <p className="dl-note small">Занято на телефоне: {mb(usage.used)}</p>}
        </>
      )}

      {pickSurahs && meta && status && (
        <Sheet onClose={() => setPickSurahs(false)} tall>
          <SheetHead title="Аудио по сурам" sub={recName} onClose={() => setPickSurahs(false)} />
          {job?.kind === 'audio' && <Progress id={job.id} />}
          <div className="body">
            {meta.surahs.map((s) => {
              const have = status.audio.perSurah.get(s.id) ?? 0
              const full = have >= s.ayahs
              return (
                <div key={s.id} className="opt-row">
                  <div className="num-badge"><span>{s.id}</span></div>
                  <span>{s.name}<small>{s.ayahs} аятов{have && !full ? ` · скачано ${have}` : ''}</small></span>
                  {full ? <Icon id="check" /> : (
                    <button className="dl-link" disabled={busy} onClick={() => downloadAudio(reciter, [s], s.name)}>Скачать</button>
                  )}
                </div>
              )
            })}
          </div>
        </Sheet>
      )}
      <TabBar />
    </div>
  )
}
