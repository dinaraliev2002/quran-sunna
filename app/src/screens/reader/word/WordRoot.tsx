import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadRoots } from '../../../lib/morph'
import { formLabel } from '../../../lib/morphLabels'
import { plural } from '../../../lib/plural'
import { useWordSheet } from '../../../store/wordSheet'
import type { RootInfo } from '../../../types/morph'

/** Корень из общего списка: undefined — грузится, null — нет данных */
function useRoot(root: string | null) {
  const [info, setInfo] = useState<RootInfo | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    if (!root) return
    loadRoots().then((r) => alive && setInfo(r?.[root] ?? null))
    return () => { alive = false }
  }, [root])
  return root ? info : null
}

/** Переход к аяту (или слову) из окна разбора */
function useGo() {
  const nav = useNavigate()
  const close = useWordSheet((s) => s.close)
  return (ref: string) => { const [s, a] = ref.split(':'); close(); nav(`/read/${s}?a=${a}&from=link`) }
}

const verbs = (n: number) => `${n} ${plural(n, 'слово', 'слова', 'слов')}`
const ayahs = (n: number) => `${n} ${plural(n, 'аят', 'аята', 'аятов')}`

/** Вкладка «Где ещё»: аяты, где встречается этот корень */
export function WhereTab({ root }: { root: string | null }) {
  const info = useRoot(root)
  const go = useGo()
  const [all, setAll] = useState(false)
  if (!root) return <p className="wd-note">У этого слова нет корня (это частица или местоимение).</p>
  if (info === undefined) return <div className="loading">Загрузка…</div>
  if (!info) return <p className="wd-note">Данных об этом корне нет.</p>
  const list = all ? info.v : info.v.slice(0, 48)
  return (
    <>
      <p className="wd-note">Корень <b className="ar">{root}</b> встречается в Коране в {verbs(info.n)}, в {ayahs(info.v.length)}.</p>
      <div className="wd-refs">
        {list.map((k) => <button key={k} onClick={() => go(k)}>{k}</button>)}
        {!all && info.v.length > list.length && <button className="more" onClick={() => setAll(true)}>ещё {info.v.length - list.length}</button>}
      </div>
    </>
  )
}

/** Вкладка «Формы»: какие формы слов с этим корнем есть в Коране (глаголы по породам и временам, имена, причастия) */
export function FormsTab({ root }: { root: string | null }) {
  const info = useRoot(root)
  const go = useGo()
  const [limit, setLimit] = useState(24)
  if (!root) return <p className="wd-note">У этого слова нет корня, поэтому форм нет.</p>
  if (info === undefined) return <div className="loading">Загрузка…</div>
  if (!info) return <p className="wd-note">Данных об этом корне нет.</p>
  const groups: [string, typeof info.f][] = [
    ['Глаголы', info.f.filter((f) => f[2].startsWith('V|'))],
    ['Имена, причастия, масдары', info.f.filter((f) => f[2].startsWith('N|'))],
  ]
  return (
    <>
      <p className="wd-note">Формы корня <b className="ar">{root}</b>, которые встречаются в Коране. Справа — сколько раз.</p>
      {groups.filter(([, l]) => l.length).map(([title, list]) => (
        <section key={title}>
          <div className="wd-sub">{title} · {list.length}</div>
          {list.slice(0, limit).map((f) => (
            <div className="wd-form" key={f[0] + f[2]}>
              <div className="ar" dir="rtl">{f[0]}</div>
              <div className="mid">
                <span>{formLabel(f[2])}</span>
                <div className="wd-refs sm">{f[4].map((r) => <button key={r} onClick={() => go(r)}>{r.split(':').slice(0, 2).join(':')}</button>)}</div>
              </div>
              <b>{f[3]}</b>
            </div>
          ))}
        </section>
      ))}
      {groups.some(([, l]) => l.length > limit) && <button className="wd-more" onClick={() => setLimit((n) => n + 40)}>Показать ещё</button>}
    </>
  )
}
