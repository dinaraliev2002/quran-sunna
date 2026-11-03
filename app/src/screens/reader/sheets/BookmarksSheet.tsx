import { useEffect, useState } from 'react'
import { Icon } from '../../../components/Icon'
import { Sheet, SheetHead } from '../../../components/ui'
import { loadSurah, type Surah } from '../../../lib/data'

export function BookmarksSheet({ bookmarks, surahs, onClose, onOpen, onRemove }: {
  bookmarks: string[]; surahs: Surah[]; onClose: () => void; onOpen: (s: number, a: number) => void; onRemove: (k: string) => void
}) {
  const [texts, setTexts] = useState<Record<string, string>>({})
  useEffect(() => {
    const sids = [...new Set(bookmarks.map((k) => Number(k.split(':')[0])))]
    Promise.all(sids.map((s) => loadSurah(s).then((a) => [s, a] as const))).then((all) => {
      const t: Record<string, string> = {}
      for (const [s, ayahs] of all) for (const a of ayahs) if (bookmarks.includes(`${s}:${a.n}`)) t[`${s}:${a.n}`] = a.ku
      setTexts(t)
    })
  }, [bookmarks])
  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="Закладки" sub={bookmarks.length ? `${bookmarks.length}` : undefined} onClose={onClose} />
      <div className="body">
        {bookmarks.length === 0 && <div className="empty">Пока пусто. Нажмите 🔖 у аята, чтобы добавить.</div>}
        {bookmarks.map((k) => {
          const [s, a] = k.split(':').map(Number)
          return (
            <div key={k} className="opt-row">
              <Icon id="bookmark" />
              <span onClick={() => onOpen(s, a)} style={{ cursor: 'pointer' }}>
                {surahs[s - 1].name}, аят {a}
                <small>{(texts[k] ?? '').slice(0, 90)}{(texts[k]?.length ?? 0) > 90 ? '…' : ''}</small>
              </span>
              <button className="xbtn" onClick={() => onRemove(k)} aria-label="Удалить"><Icon id="close" /></button>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
