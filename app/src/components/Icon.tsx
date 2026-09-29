import type { CSSProperties } from 'react'

// Иконки (SVG-спрайт). Спрайт вставляется один раз в App, дальше <Icon id="book" />.

const PATHS: Record<string, string> = {
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7"/>',
  open: '<path d="M12 6.5C10 5 7 4.5 3 5v13c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5z"/><path d="M12 6.5v13"/>',
  scroll: '<path d="M8 3h11a2 2 0 0 1 2 2v2h-4"/><path d="M17 7v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h9v1a2 2 0 0 0 2 2"/><path d="M8 3a2 2 0 0 0-2 2v13"/><path d="M10 9h4M10 13h4"/>',
  hands: '<path d="M7 21v-4l-3-4.5a2 2 0 0 1 .3-2.6L7 7.5V4a1 1 0 0 1 2 0v8"/><path d="M17 21v-4l3-4.5a2 2 0 0 0-.3-2.6L17 7.5V4a1 1 0 0 0-2 0v8"/>',
  star: '<path d="M12 2.5l2.4 5.2 5.6.6-4.2 3.8 1.2 5.5L12 14.8l-5 2.8 1.2-5.5L4 8.3l5.6-.6z"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  flame: '<path d="M12 22c4 0 7-2.7 7-7 0-4-3-6.5-4-10-2 2-2.5 4-2.5 5.5C11 9 10 7.5 10 5.5 7 8 5 11 5 15c0 4.3 3 7 7 7z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/>',
  repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  rows: '<path d="M5 5h14M5 9.5h14M5 14h14M5 18.5h9"/>',
  page: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  words: '<path d="M4 7h6M14 7h6M4 17h6M14 17h6"/><path d="M5 11h4M15 11h4M5 21h4M15 21h4" opacity=".5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  font: '<path d="M4 19 9 5l5 14M6 14h6M15 19l3-8 3 8M16 16.5h4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  sunrise: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0"/><path d="M12 4v5M9.5 6.5 12 4l2.5 2.5M3.5 13l1.4 1M20.5 13l-1.4 1"/>',
  bed: '<path d="M3 18V7M21 18v-5a3 3 0 0 0-3-3H10v8"/><path d="M3 14h18"/><circle cx="6.5" cy="10.5" r="1.8"/>',
  cup: '<path d="M5 8h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17M8 3v2M11 3v2M14 3v2"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  kaaba: '<path d="M4 8l8-4 8 4v10l-8 3-8-3z"/><path d="M4 8l8 3 8-3M12 11v10M4 11.5l8 3 8-3"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.8-3.4 3.2-5 6-5s5.2 1.6 6 5"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 15c1.6.6 2.6 2.2 3 5"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-4 6-7 10-9"/>',
  download:'<path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/>',
  tools: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  ornament: '<g fill="none" stroke="currentColor" stroke-width="2" transform="scale(.24)"><rect x="20" y="20" width="60" height="60"/><rect x="20" y="20" width="60" height="60" transform="rotate(45 50 50)"/><circle cx="50" cy="50" r="18"/><circle cx="50" cy="50" r="44"/></g>',
}

export function IconSprite() {
  const html = Object.entries(PATHS)
    .map(([id, d]) => `<symbol id="i-${id}" viewBox="0 0 24 24">${d}</symbol>`)
    .join('')
  return <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden dangerouslySetInnerHTML={{ __html: `<defs>${html}</defs>` }} />
}

export function Icon({ id, className = 'icon', style }: { id: string; className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} aria-hidden>
      <use href={`#i-${id}`} />
    </svg>
  )
}
