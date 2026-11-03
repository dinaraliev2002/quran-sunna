import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Sheet, SheetHead, TabBar, useQuranMeta } from '../components/ui'
import { Tour } from '../components/Tour'
import { appleWebKit, fontVariant } from '../lib/fonts'
import { TOTAL_PAGES, type Surah } from '../lib/data'
import { idbSizes, storageUsage } from '../lib/idb'
import { cancelDownload, deleteAudioSurah, deleteDownloads, downloadAudio, downloadData, downloadFonts, offlineStatus, useDownloads } from '../lib/offline'
import { RECITERS, bitrateOf, setBitrates } from '../store/player'
import { useStore } from '../store/settings'
import { useUi } from '../store/ui'

type Status = Awaited<ReturnType<typeof offlineStatus>>
const mb = (bytes: number) => (bytes >= 1e9 ? (bytes / 1e9).toFixed(1) + ' ГБ' : Math.round(bytes / 1e6) + ' МБ')

const mbs = (bytes: number) => (bytes >= 1e9 ? (bytes / 1e9).toFixed(1) + ' ГБ' : bytes >= 1e6 ? Math.round(bytes / 1e6) + ' МБ' : Math.max(1, Math.round(bytes / 1e3)) + ' КБ')
const FONT_NAME: Record<string, string> = { v2: 'Страницы без таджвида', v4c: 'Страницы с таджвидом', 'v4s-light': 'Страницы с таджвидом · светлая тема', 'v4s-dark': 'Страницы с таджвидом · тёмная тема' }

/** Что занимает место: аудио по чтецам (всё или по сурам) и шрифты страниц; удаление с подтверждением */
function Storage({ surahs, version, busy }: { surahs: Surah[]; version: number; busy: boolean }) {
  const [audio, setAudio] = useState<{ key: string; size: number }[] | null>(null)
  const [fonts, setFonts] = useState<{ key: string; size: number }[] | null>(null)
  const [confirm, setConfirm] = useState('')
  const [open, setOpen] = useState<string | null>(null) // чтец, у которого правим суры
  useEffect(() => {
    idbSizes('audio:').then(setAudio)
    idbSizes('font:').then(setFonts)
  }, [version])
  if (!audio || !fonts) return null
  // аудио по чтецам: ключ «audio:чтец:ССС ААА»
  const byRec = new Map<string, { n: number; size: number }>()
  for (const it of audio) { const r = it.key.split(':')[1]; const o = byRec.get(r) ?? { n: 0, size: 0 }; o.n++; o.size += it.size; byRec.set(r, o) }
  const byVar = new Map<string, { n: number; size: number }>()
  for (const it of fonts) { const v = it.key.split(':')[1]; const o = byVar.get(v) ?? { n: 0, size: 0 }; o.n++; o.size += it.size; byVar.set(v, o) }
  if (!byRec.size && !byVar.size) return null
  const ask = (id: string, run: () => void) => (confirm === id ? <button className="dl-link danger" disabled={busy} onClick={() => { setConfirm(''); run() }}>Точно удалить</button> : <button className="dl-link danger" disabled={busy} onClick={() => setConfirm(id)}>Удалить</button>)
  return (
    <>
      <div className="group-t">Что занимает место</div>
      {[...byRec].map(([r, v]) => (
        <div key={r} className="dl-card">
          <div className="dl-head"><span className="dl-ic"><Icon id="sound" /></span><div className="t"><b>Аудио · {(RECITERS[r] ?? { name: r }).name}</b><span>{v.n} {v.n === 1 ? 'аят' : 'аятов'} · {mbs(v.size)}</span></div></div>
          <div className="dl-row"><button className="dl-link" disabled={busy} onClick={() => setOpen(r)}>По сурам</button>{ask('a:' + r, () => deleteDownloads('audio', r))}</div>
        </div>
      ))}
      {[...byVar].map(([v, o]) => (
        <div key={v} className="dl-card">
          <div className="dl-head"><span className="dl-ic"><Icon id="open" /></span><div className="t"><b>{FONT_NAME[v] ?? v}</b><span>{o.n} из {TOTAL_PAGES} страниц · {mbs(o.size)}</span></div></div>
          <div className="dl-row"><span /> {ask('f:' + v, () => deleteDownloads('fonts', v))}</div>
        </div>
      ))}
      <p className="dl-note small">Удалённое можно скачать снова. Страницы и аудио, которые вы откроете, снова сохранятся сами, если места хватает.</p>
      {open && (
        <Sheet onClose={() => setOpen(null)} tall>
          <SheetHead title="Аудио по сурам" sub={(RECITERS[open] ?? { name: open }).name} onClose={() => setOpen(null)} />
          <div className="body">
            {surahs.map((s) => {
              const its = audio.filter((x) => x.key.startsWith(`audio:${open}:${String(s.id).padStart(3, '0')}`))
              if (!its.length) return null
              return (
                <div key={s.id} className="opt-row">
                  <div className="num-badge"><span>{s.id}</span></div>
                  <span>{s.name}<small>{its.length} из {s.ayahs} · {mbs(its.reduce((a, x) => a + x.size, 0))}</small></span>
                  <button className="dl-link danger" disabled={busy} onClick={() => deleteAudioSurah(open, s.id)}>Удалить</button>
                </div>
              )
            })}
          </div>
        </Sheet>
      )}
    </>
  )
}

export default function Downloads() {
  const nav = useNavigate()
  const meta = useQuranMeta()
  const { tajweed, reciter, bitrates } = useStore()
  const kbps = bitrateOf(reciter, bitrates)
  setBitrates(bitrates) // загрузка пойдёт в выбранном качестве
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
          <Card icon="sound" id={'audio:' + reciter} title={`Аудио · ${recName}`} sub={`Весь Коран по аятам · ${kbps} кбит/с · ≈ ${kbps <= 64 ? '0,5' : kbps <= 128 ? '1' : '1,4'} ГБ. Качество — в настройках, в выборе чтеца`}
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
          {meta && <Storage surahs={meta.surahs} version={version} busy={busy} />}
        </>
      )}

      {pickSurahs && meta && status && (
        <Sheet onClose={() => setPickSurahs(false)} tall>
          <SheetHead title="Аудио по сурам" sub={recName} onClose={() => setPickSurahs(false)} />
          {job?.kind === 'audio' && <Progress id={job.id} />}
          <p className="hz-how" style={{ margin: '0 16px 8px' }}>Нажимайте «Скачать» у любого числа сур подряд — они встанут в очередь и скачаются одна за другой.</p>
          <div className="body">
            {meta.surahs.map((s) => {
              const have = status.audio.perSurah.get(s.id) ?? 0
              const full = have >= s.ayahs
              const queued = job?.id === 'audio:' + reciter && !!job.queued?.includes(s.id)
              return (
                <div key={s.id} className="opt-row">
                  <div className="num-badge"><span>{s.id}</span></div>
                  <span>{s.name}<small>{s.ayahs} аятов{have && !full ? ` · скачано ${have}` : ''}</small></span>
                  {full ? <Icon id="check" /> : queued ? <small>В очереди…</small> : (
                    <button className="dl-link" onClick={() => downloadAudio(reciter, [s], s.name)}>Скачать</button>
                  )}
                </div>
              )
            })}
          </div>
        </Sheet>
      )}
      <TabBar />
      <Tour id="downloads" ready={!!status} steps={[
        { el: '.dl-card', title: 'Скачайте заранее', text: 'Текст, страницы мусхафа и аудио можно скачать — тогда всё работает без интернета.' },
        { title: 'Что занимает место', text: 'Внизу списка видно, сколько места занимает аудио каждого чтеца и шрифты страниц. Лишнее можно удалить: всё сразу или по отдельным сурам.' },
      ]} />
    </div>
  )
}
