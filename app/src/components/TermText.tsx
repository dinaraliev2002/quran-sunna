import { useEffect, useState } from 'react'
import { loadTermMatcher, type TermMatcher } from '../lib/termHighlight'
import { useStore } from '../store/settings'
import { useTermPop } from '../screens/glossary/TermPop'

/** Подсветка терминов словаря: поиск и уже отмеченные в этом тексте термины (каждый подсвечиваем один раз на текст) */
export type Terms = { m: TermMatcher; seen: Set<string> } | null

/**
 * Подсветка терминов для одного текста: вызывать в компоненте, который рисует весь текст,
 * и передавать результат в <Plain>. Выключается в «Настройки → Чтение → Подсветка терминов».
 */
export function useTerms(): Terms {
  const on = useStore((s) => s.termHl)
  const [m, setM] = useState<TermMatcher | null>(null)
  useEffect(() => { if (on) loadTermMatcher().then(setM) }, [on])
  return on && m ? { m, seen: new Set() } : null
}

/** Обычный кусок текста: термины из словаря отмечены цветом, нажатие открывает пояснение */
export function Plain({ t, terms }: { t: string; terms: Terms }) {
  if (!terms) return <>{t}</>
  return <>{terms.m.find(t, terms.seen).map((p, i) => typeof p === 'string' ? p : <span key={i} className="term" role="button" onClick={() => useTermPop.getState().open(p.item)}>{p.text}</span>)}</>
}
