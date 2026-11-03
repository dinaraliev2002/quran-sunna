import { hizbOf, QUARTER_LABEL } from '../../../lib/data'
import type { Ayah } from '../../../types/quran'

/** Метка начала хизба или его четверти (как ۞ на полях печатного мусхафа) */
export function HizbMark({ a }: { a: Ayah }) {
  if (!a.rs) return null
  const { hizb, quarter } = hizbOf(a.r)
  const juzStart = quarter === 0 && hizb % 2 === 1
  return (
    <div className="hmark">
      <span>۞</span>
      {quarter === 0 ? <b>Хизб {hizb}{juzStart ? ` · Джуз ${(hizb + 1) / 2}` : ''}</b> : <b>{QUARTER_LABEL[quarter]} хизба {hizb}</b>}
    </div>
  )
}
