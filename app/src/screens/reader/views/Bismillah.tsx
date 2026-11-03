import { useEffect, useState } from 'react'
import { loadSurah } from '../../../lib/data'
import { QpcText } from './QpcText'

// «Бисмилля» — глифами первой страницы мусхафа (1:1 без знака конца аята)
let bismGlyphs: string | null = null
export function Bismillah({ tajweed, className }: { tajweed: boolean; className: string }) {
  const [g, setG] = useState(bismGlyphs)
  useEffect(() => {
    if (!g) loadSurah(1).then((a) => { bismGlyphs = a[0].g.split(' ').slice(0, -1).join(' '); setG(bismGlyphs) })
  }, [g])
  return g ? <QpcText page={1} glyphs={g} tajweed={tajweed} className={className} /> : <div className={className}>&nbsp;</div>
}
