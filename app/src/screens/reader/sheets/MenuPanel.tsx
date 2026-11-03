import { Icon } from '../../../components/Icon'
import { Sheet, SheetHead } from '../../../components/ui'
import type { ReadMode } from '../../../types/settings'

export function MenuPanel({ sub, mode, tajweed, wbw, onWbw, onClose, onPlay, onBookmarks, onSearch, onMemo, onTajweed, onSettings, onGlossary, onSajda }: {
  sub: string; tajweed: boolean; mode: ReadMode; wbw: boolean; onWbw: () => void
  onClose: () => void; onPlay: () => void; onBookmarks: () => void; onSearch: () => void; onMemo: () => void; onTajweed: () => void; onSettings: () => void; onGlossary?: () => void; onSajda?: () => void
}) {
  // окно снизу — закрывается свайпом вниз, как и остальные
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="Меню" sub={sub} onClose={onClose} />
      <div className="menu-body">
        <div className="quick">
          <button onClick={onPlay}><Icon id="play" />Слушать</button>
          <button onClick={onBookmarks}><Icon id="bookmark" />Закладки</button>
          <button onClick={onSearch}><Icon id="search" />Поиск</button>
        </div>
        <button className="mrow" onClick={onMemo}>
          <span className="mi"><Icon id="repeat" /></span>
          <div className="t"><b>Заучивание</b><span>Отрывок, повторы, скрытие текста</span></div>
          <Icon id="right" className="icon chev" />
        </button>
        {mode !== 'mushaf' && (
          <button className="mrow" onClick={onWbw}>
            <span className="mi"><Icon id="words" /></span>
            <div className="t"><b>Пословный перевод</b><span>Русская подпись под каждым словом</span></div>
            <span className={'switch' + (wbw ? ' on' : '')} />
          </button>
        )}
        <button className="mrow" onClick={onTajweed}>
          <span className="mi"><Icon id="eye" /></span>
          <div className="t"><b>Таджвид</b><span>Цветная подсветка правил чтения</span></div>
          <span className={'switch' + (tajweed ? ' on' : '')} />
        </button>
        {onGlossary && (
          <button className="mrow" onClick={onGlossary}>
            <span className="mi"><Icon id="scroll" /></span>
            <div className="t"><b>Словарь терминов</b><span>Арабские слова и выражения из Корана</span></div>
            <Icon id="right" className="icon chev" />
          </button>
        )}
        {onSajda && (
          <button className="mrow" onClick={onSajda}>
            <span className="mi"><Icon id="sajda" /></span>
            <div className="t"><b>Земные поклоны</b><span>15 мест в Коране и мольба</span></div>
            <Icon id="right" className="icon chev" />
          </button>
        )}
        <button className="mrow" onClick={onSettings}>
          <span className="mi">Aa</span>
          <div className="t"><b>Настройки</b><span>Перевод · чтец · шрифт</span></div>
          <Icon id="right" className="icon chev" />
        </button>
      </div>
    </Sheet>
  )
}
