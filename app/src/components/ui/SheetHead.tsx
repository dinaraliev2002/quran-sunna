import { Icon } from '../Icon'

export function SheetHead({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  return (
    <div className="sh">
      <div><h3>{title}</h3>{sub && <span>{sub}</span>}</div>
      <button className="xbtn" data-close onClick={onClose}><Icon id="close" /></button>
    </div>
  )
}
