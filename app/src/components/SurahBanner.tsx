import { surahGlyph } from '../lib/data'

// Классический заголовок суры, как в печатном мусхафе: двойная рамка, картуш с названием
// (каллиграфический шрифт названий сур) и восьмиконечные звёзды по краям.
// compact — узкий вариант для строки страницы мусхафа.

function Star({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const sq = r * 1.25
  return (
    <g>
      <rect x={cx - sq / 2} y={cy - sq / 2} width={sq} height={sq} />
      <rect x={cx - sq / 2} y={cy - sq / 2} width={sq} height={sq} transform={`rotate(45 ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={r * 0.32} />
    </g>
  )
}

export function SurahBanner({ sid, compact }: { sid: number; compact?: boolean }) {
  const H = compact ? 40 : 58
  const W = 360
  const m = H / 2
  const c1 = 92, c2 = W - 92 // края картуша
  const cartouche = `M${c1},${m} L${c1 + H * 0.36},${4} H${c2 - H * 0.36} L${c2},${m} L${c2 - H * 0.36},${H - 4} H${c1 + H * 0.36} Z`
  return (
    <div className={'sbanner' + (compact ? ' compact' : '')}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <defs>
          <pattern id={`sbp${compact ? 'c' : ''}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" className="sb-hatch" />
          </pattern>
        </defs>
        <rect x="1" y="1" width={W - 2} height={H - 2} rx="5" className="sb-outer" />
        <rect x="1" y="1" width={W - 2} height={H - 2} rx="5" fill={`url(#sbp${compact ? 'c' : ''})`} className="sb-fill" />
        <rect x="5" y="5" width={W - 10} height={H - 10} rx="3" className="sb-inner" />
        <path d={cartouche} className="sb-cart" />
        <g className="sb-star">
          <Star cx={46} cy={m} r={H * 0.3} />
          <Star cx={W - 46} cy={m} r={H * 0.3} />
        </g>
      </svg>
      <span className="sb-name">{surahGlyph(sid)}</span>
    </div>
  )
}
