import { tagValue } from '../../../lib/morph'
import { VERB_FORMS } from '../../../lib/morphLabels'
import type { MorphSeg } from '../../../types/morph'
import { useRoot } from '../../../hooks/useRoot'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
const VF = /VF:(\d+)/
/** «II порода — усиление» → «усиление» (номер уже показан рядом) */
const formMeaning = (vf: string) => (VERB_FORMS[vf] ?? '').split(' — ')[1] ?? 'порода'

/**
 * Блок в «Разборе»: породы глагола этого корня, которые есть в Коране, и масдар.
 * Показывается у глаголов и у слов, образованных от глагола (причастия, масдары) — у остальных его нет.
 */
export function VerbForms({ stem, root }: { stem: MorphSeg; root: string | null }) {
  const info = useRoot(root)
  const cur = tagValue(stem, 'VF')
  if (!root || !info || (stem[1] !== 'V' && !cur)) return null

  // породы: номер → сколько слов и самое частое написание
  const forms = new Map<string, { n: number; best: string; bestN: number }>()
  for (const f of info.f) {
    const vf = f[2].startsWith('V|') ? VF.exec(f[2])?.[1] : undefined
    if (!vf) continue
    const o = forms.get(vf) ?? { n: 0, best: f[0], bestN: 0 }
    o.n += f[3]
    if (f[3] > o.bestN) { o.best = f[0]; o.bestN = f[3] }
    forms.set(vf, o)
  }
  // масдар: формы корня с меткой VN
  const masdars = info.f.filter((f) => f[2].split('|').includes('VN')).slice(0, 6)
  if (!forms.size && !masdars.length) return null

  return (
    <>
      {forms.size > 0 && (
        <>
          <div className="wd-sub">Породы глагола</div>
          <p className="wd-note">Какие породы корня <b className="ar">{root}</b> есть в Коране. Порода меняет смысл глагола.</p>
          {[...forms].sort((a, b) => Number(a[0]) - Number(b[0])).map(([vf, o]) => (
            <div className={'wd-form' + (vf === cur ? ' cur' : '')} key={vf}>
              <div className="wd-roman">{ROMAN[Number(vf)] ?? vf}</div>
              <div className="mid">
                <span>{formMeaning(vf)}{vf === cur && ' · это слово'}</span>
                <span className="ar" dir="rtl" style={{ fontSize: 22, color: 'var(--gold-ink)' }}>{o.best}</span>
              </div>
              <b>{o.n}</b>
            </div>
          ))}
        </>
      )}
      {masdars.length > 0 && (
        <>
          <div className="wd-sub">Масдар</div>
          <p className="wd-note">Масдар — отглагольное имя, название самого действия («чтение», «знание»). Формы этого корня в Коране:</p>
          {masdars.map((f) => (
            <div className="wd-form" key={f[0] + f[2]}>
              <div className="ar" dir="rtl">{f[0]}</div>
              <div className="mid"><span>{f[2].includes('VF:') ? `от глагола ${ROMAN[Number(VF.exec(f[2])?.[1])] ?? ''} породы` : 'масдар'}</span></div>
              <b>{f[3]}</b>
            </div>
          ))}
        </>
      )}
    </>
  )
}
