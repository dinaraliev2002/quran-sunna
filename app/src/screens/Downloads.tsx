import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ReciterList } from '../components/ReciterList'
import { Sheet, SheetHead, TabBar } from '../components/ui'
import { useQuranMeta } from '../hooks/useQuranMeta'
import { Tour } from '../components/Tour'
import { appleWebKit, fontVariant } from '../lib/fonts'
import { TOTAL_PAGES, type Surah } from '../lib/data'
import { idbSizes, storageUsage } from '../lib/idb'
import { cancelDownload, deleteAudioSurah, deleteDownloads, downloadAudio, downloadData, downloadFonts, offlineStatus, useDownloads } from '../lib/offline'
import { RECITERS } from '../store/player'
import { useStore } from '../store/settings'
import { useUi } from '../store/ui'
import { isNative } from '../lib/telegram'
import { plural } from '../lib/plural'

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
    idbSizes('sura:').then(setAudio)
    idbSizes('font:').then(setFonts)
  }, [version])
  if (!audio || !fonts) return null
  // аудио по чтецам: ключ «sura:чтец:ССС» — запись суры целиком
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
          <div className="dl-head"><span className="dl-ic"><Icon id="sound" /></span><div className="t"><b>Аудио · {(RECITERS[r] ?? { name: r }).name}</b><span>{v.n} {plural(v.n, 'сура', 'суры', 'сур')} · {mbs(v.size)}</span></div></div>
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
              const it = audio.find((x) => x.key === `sura:${open}:${String(s.id).padStart(3, '0')}`)
              if (!it) return null
              return (
                <div key={s.id} className="opt-row">
                  <div className="num-badge"><span>{s.id}</span></div>
                  <span>{s.name}<small>{mbs(it.size)}</small></span>
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
  const { tajweed, reciter: playReciter } = useStore()
  // чтец для загрузки выбирается здесь и не меняет того, кого вы слушаете
  const [dlReciter, setDlReciter] = useState<string | null>(null)
  const [pickRec, setPickRec] = useState(false)
  const reciter = dlReciter ?? playReciter
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
        <div className="dl-row"><span>{job.kind === 'audio' ? `${mbs(job.done)} из ${mbs(job.total)}` : `${job.done} из ${job.total}`}{job.failed ? ` · ошибок ${job.failed}` : ''}</span><button className="dl-link" onClick={cancelDownload}>Отменить</button></div>
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
          {!isNative && ( // в приложении из магазина текст Корана уже внутри — карточка не нужна
            <Card icon="book" id="data" title="Текст Корана" sub="Аяты, 2 перевода, тафсир, раскладка страниц · ≈ 23 МБ"
              done={status.data.done} total={status.data.total} onDownload={downloadData} />
          )}
          <Card icon="open" id={'fonts:' + variant} title="Страницы мусхафа"
            sub={`Шрифты 604 страниц ${tajweed ? 'с таджвидом' : 'без таджвида'}${appleWebKit && tajweed ? (theme === 'dark' ? ' (тёмная тема)' : ' (светлая тема)') : ''} · ${fontsSize}`}
            done={status.fonts.done} total={status.fonts.total} onDownload={() => downloadFonts(variant)} onDelete={() => deleteDownloads('fonts', variant)} />
          <Card icon="sound" id={'audio:' + reciter} title={`Аудио · ${recName}`} sub={`Весь Коран, 114 сур${status.audio.bytes ? ` · ≈ ${mb(status.audio.bytes)}` : ''}`}
            done={status.audio.done} total={status.audio.total}
            onDownload={() => meta && downloadAudio(reciter, meta.surahs, 'Весь Коран')} onDelete={() => deleteDownloads('audio', reciter)}>
            <button className="srow2" style={{ marginTop: 10, marginBottom: 0 }} disabled={busy} onClick={() => setPickRec(true)}>
              <div>Другой чтец<span>Сейчас: {recName}. Выберите, чьё чтение скачать</span></div><Icon id="right" className="icon" />
            </button>
            <button className="srow2" style={{ marginTop: 8, marginBottom: 0 }} disabled={busy} onClick={() => setPickSurahs(true)}>
              <div>Скачать отдельные суры<span>Скачано: {status.audio.fullSurahs.length} из 114</span></div><Icon id="right" className="icon" />
            </button>
          </Card>
          <p className="dl-note small">
            У каждого чтеца свои загрузки: выберите чтеца кнопкой «Другой чтец» и скачайте весь Коран или отдельные суры.
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
              const full = status.audio.fullSurahs.includes(s.id)
              const queued = job?.id === 'audio:' + reciter && !!job.queued?.includes(s.id)
              return (
                <div key={s.id} className="opt-row">
                  <div className="num-badge"><span>{s.id}</span></div>
                  <span>{s.name}<small>{s.ayahs} {plural(s.ayahs, 'аят', 'аята', 'аятов')}{status.audio.sizes[s.id - 1] ? ` · ${mbs(status.audio.sizes[s.id - 1])}` : ''}</small></span>
                  {full ? <Icon id="check" /> : queued ? <small>В очереди…</small> : (
                    <button className="dl-link" onClick={() => downloadAudio(reciter, [s], s.name)}>Скачать</button>
                  )}
                </div>
              )
            })}
          </div>
        </Sheet>
      )}
      {pickRec && (
        <Sheet onClose={() => setPickRec(false)} tall>
          <SheetHead title="Чтец для загрузки" sub="Тот, кого вы слушаете, не меняется" onClose={() => setPickRec(false)} />
          <div className="body"><ReciterList current={reciter} onPick={(id) => { setDlReciter(id); setPickRec(false) }} /></div>
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
