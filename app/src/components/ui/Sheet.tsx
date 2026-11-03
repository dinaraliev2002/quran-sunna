import { useRef, type MouseEvent, type ReactNode } from 'react'
import { useSwipeToClose } from '../../hooks/useSwipeToClose'

/**
 * Всплывающее окно снизу. Закрывается: тапом по затемнению, крестиком или свайпом вниз —
 * за «ручку»/заголовок, а если содержимое прокручено до верха — и за само содержимое.
 */
export function Sheet({ onClose, children, tall, onDim }: { onClose: () => void; children: ReactNode; tall?: boolean; onDim?: (e: MouseEvent) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const dimRef = useRef<HTMLDivElement>(null)
  useSwipeToClose(ref, dimRef, onClose)

  return (
    <>
      <div className="dim" ref={dimRef} onClick={onDim ?? onClose} />
      <div className={'sheet' + (tall ? ' tall' : '')} ref={ref}>
        <div className="handle" />
        {children}
      </div>
    </>
  )
}
