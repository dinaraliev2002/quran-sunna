import { useEffect, useState } from 'react'
import { KvNote } from './KvFormat'
import { hasKuliev, isSajda, loadKulievIndex, loadKulievSurah, loadSajda, type KulievIndex, type KulievSurah, type SajdaData } from '../../lib/data'

// оглавление комментариев Кулиева — одно на всё приложение; пока не загрузилось (или файлов нет, как в публичной сборке) — null
let ixReady: KulievIndex | null = null
export function useKulievIndex() {
  const [ix, setIx] = useState(ixReady)
  useEffect(() => { if (ixReady) setIx(ixReady); else loadKulievIndex().then((x) => { if (x) ixReady = x; setIx(x) }) }, [])
  return ix
}

/** «Комментарий» в окне аята: пояснения из «Комментариев к переводу смыслов Корана» (Э. Кулиев). Нет пояснений — блока нет. */
export function KulievBlock({ surah, ayah }: { surah: number; ayah: number }) {
  const ix = useKulievIndex()
  const [data, setData] = useState<KulievSurah | null>(null)
  const has = hasKuliev(ix, surah, ayah)
  useEffect(() => { if (has) loadKulievSurah(surah).then(setData) }, [has, surah])
  const notes = data?.notes[String(ayah)]
  if (!has || !notes?.length) return null
  return (
    <>
      <div className="as-label">Комментарий</div>
      <div className="kv">
        {notes.map((paras, i) => <div key={i} className="kv-note"><KvNote paras={paras} /></div>)}
        <div className="kv-src">Комментарии к переводу смыслов Корана, Э. Кулиев (издание Комплекса короля Фахда).</div>
      </div>
    </>
  )
}

/** Земной поклон у аята: что делать и мольба */
export function SajdaBlock({ surah, ayah }: { surah: number; ayah: number }) {
  const ix = useKulievIndex()
  const [sj, setSj] = useState<SajdaData | null>(null)
  const yes = isSajda(ix, surah, ayah)
  useEffect(() => { if (yes) loadSajda().then(setSj) }, [yes])
  if (!yes || !sj) return null
  const disputed = sj.places.find((p) => p.surah === surah && p.ayah === ayah)?.disputed
  return (
    <>
      <div className="as-label">Земной поклон</div>
      <div className="kv sj">
        <p className="kv-p">После этого аята желательно совершить земной поклон.{disputed ? ` ${sj.note}` : ''}</p>
        <div className="sj-label">Мольба при земном поклоне</div>
        <div className="sj-ar">{sj.dua_ar}</div>
        <p className="kv-p">{sj.dua_ru} Об этом сообщил {sj.dua_src}.</p>
      </div>
    </>
  )
}
