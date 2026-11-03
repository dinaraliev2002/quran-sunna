import { SurahBanner } from '../../../components/SurahBanner'
import type { Surah } from '../../../types/quran'
import { SurahStoryButton } from '../Asbab'
import { Bismillah } from './Bismillah'

// ---------- Заголовок суры ----------
export function SurahHead({ s, tajweed }: { s: Surah; tajweed: boolean }) {
  return (
    <div className="s-head">
      <SurahBanner sid={s.id} />
      <div className="s-meta">{s.mk ? 'Мекканская' : 'Мединская'} · {s.ayahs} аятов</div>
      <SurahStoryButton sid={s.id} name={s.name} />
      {s.id !== 1 && s.id !== 9 && <Bismillah tajweed={tajweed} className="bism" />}
    </div>
  )
}
