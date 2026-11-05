import { useEffect, useState } from 'react'
import { loadWbw } from '../../../lib/data'
import { loadMorph, wordText } from '../../../lib/morph'
import { loadSyntax, loadSyntaxLabels } from '../../../lib/syntax'
import { roleInfo } from '../../../lib/syntaxLabels'
import { useWordSheet } from '../../../store/wordSheet'
import type { MorphSurah, MorphWord, SyntaxSurah, WordTarget } from '../../../types/morph'

interface Data { labels: string[]; syn: SyntaxSurah; morph: MorphSurah | null; tr: string[][] | null }

/** Вкладка «Роль»: какую роль слово играет в предложении (ирааб), от чего зависит и что зависит от него */
export function RoleTab({ target, word }: { target: WordTarget; word: MorphWord }) {
  const [d, setD] = useState<Data | null | undefined>(undefined)
  const open = useWordSheet((s) => s.open)
  useEffect(() => {
    let alive = true
    Promise.all([loadSyntaxLabels(), loadSyntax(target.s), loadMorph(target.s), loadWbw(target.s).catch(() => null)]).then(([labels, syn, morph, tr]) => {
      if (alive) setD(labels && syn ? { labels, syn, morph, tr } : null)
    })
    return () => { alive = false }
  }, [target.s])

  if (d === undefined) return <div className="loading">Загрузка…</div>
  if (d === null) return <p className="wd-note">Для этого слова нет разбора роли.</p>

  const { labels, syn, morph, tr } = d
  const mine = syn[String(target.a)]?.[target.w - 1] ?? []
  if (!mine.length) return <p className="wd-note">У этого слова нет самостоятельной роли в предложении: оно входит в состав соседнего слова.</p>

  const isVerb = word.some((g) => g[1] === 'V')
  // слово аята: арабский текст и русская подпись (пустая подпись — слово переведено вместе с предыдущим)
  const info = (a: number, w: number) => {
    const m = morph?.[String(a)]?.[w - 1]
    const row = tr?.[a - 1]
    let k = w - 1
    while (row && k > 0 && !row[k]) k--
    return { ar: m ? wordText(m) : '', tr: row?.[k] ?? '' }
  }
  const go = (a: number, w: number) => open({ s: target.s, a, w })

  // слова этого же аята, которые зависят от нашего
  const ayah = syn[String(target.a)] ?? []
  const deps = ayah.flatMap((segs, i) => segs.filter((g) => g[1] === target.w && g[2] === 0 && i + 1 !== target.w).map((g) => ({ w: i + 1, label: labels[g[0]] })))

  return (
    <>
      <p className="wd-note">Роль слова в предложении по традиции ирааба: кто что делает и к чему относится каждое слово.</p>
      {mine.map((g, i) => {
        const label = labels[g[0]]
        const r = roleInfo(label, isVerb)
        const part = word[g[3] - 1]
        const head = g[1] > 0 && !(g[1] === target.w && !g[2]) ? info(g[2] || target.a, g[1]) : null // вершина внутри того же слова (приставка) не показываем
        return (
          <div className="wd-role" key={i}>
            <div className="wd-role-top">
              {part && word.length > 1 && <span className="ar" dir="rtl">{part[0]}</span>}
              <div>
                <b>{r.ru}</b>
                {label !== 'root' && <span className="ar" dir="rtl">{label}</span>}
              </div>
            </div>
            {r.hint && <p>{r.hint}</p>}
            {g[1] === 0 && <p className="wd-dim">Это главное слово предложения.</p>}
            {g[1] === -1 && <p className="wd-dim">Относится к слову, которое подразумевается, но в тексте не написано (например, «начинаю», «пребывает»).</p>}
            {head && (
              <button className="wd-link" onClick={() => go(g[2] || target.a, g[1])}>
                <span className="wd-dim">Относится к слову{g[2] ? ` в аяте ${g[2]}` : ''}</span>
                <span className="ar" dir="rtl">{head.ar}</span>
                <span>{head.tr}</span>
              </button>
            )}
          </div>
        )
      })}
      {deps.length > 0 && (
        <>
          <div className="wd-sub">Зависят от этого слова</div>
          {deps.map((x) => {
            const f = info(target.a, x.w)
            return (
              <button className="wd-link" key={x.w + x.label} onClick={() => go(target.a, x.w)}>
                <span className="wd-dim">{roleInfo(x.label).ru}</span>
                <span className="ar" dir="rtl">{f.ar}</span>
                <span>{f.tr}</span>
              </button>
            )
          })}
        </>
      )}
    </>
  )
}
