import { Icon } from '../components/Icon'
import { Sheet, SheetHead } from '../components/ui'
import { haptic } from '../lib/telegram'
import { useStore, type Translation } from '../store/settings'

export const TRANSLATIONS: Record<Translation, string> = { ku: 'Эльмир Кулиев', aa: 'Абу Адель' }
export const BUKHARI: Record<'main' | 'sharkasi', string> = { main: 'Основная версия', sharkasi: 'Абу Ислам аш-Шаркаси' }

/** «Переводы и источники»: чей перевод Корана, какой тафсир, чья версия хадисов читается */
export function SourcesSheet({ onClose }: { onClose: () => void }) {
  const st = useStore()
  const row = (key: string, on: boolean, title: string, sub: string | undefined, pick: () => void) => (
    <button key={key} className="opt-row" onClick={() => { haptic.tick(); pick() }}>
      <span>{title}{sub && <small style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', fontWeight: 600, marginTop: 2 }}>{sub}</small>}</span>
      {on && <Icon id="check" />}
    </button>
  )
  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="Переводы и источники" sub="Чьи тексты читать в каждом разделе" onClose={onClose} />
      <div className="body">
        <div className="group-t">Коран · перевод смыслов</div>
        {(Object.keys(TRANSLATIONS) as Translation[]).map((k) => row(k, st.translation === k, TRANSLATIONS[k], undefined, () => st.set({ translation: k })))}
        <div className="group-t">Коран · тафсир</div>
        {row('tf', true, 'Ас-Саади', 'Пока единственный; другие появятся позже', () => {})}
        <div className="group-t">Хадисы · «Сахих» аль-Бухари</div>
        {row('bm', st.hdBukhari === 'main', BUKHARI.main, 'Полный перевод, 97 книг, с цепочками передатчиков', () => st.set({ hdBukhari: 'main' }))}
        {row('bs', st.hdBukhari === 'sharkasi', BUKHARI.sharkasi, '«Достоверный сборник»: пока первые 47 книг из 97', () => st.set({ hdBukhari: 'sharkasi' }))}
      </div>
    </Sheet>
  )
}
