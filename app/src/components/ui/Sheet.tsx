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
  const closing = useRef(false)
  // Закрытие нажатием (крестик, затемнение): окно плавно уезжает вниз, затемнение тает, и только потом окно убирается
  const close = () => {
    const el = ref.current
    if (!el || closing.current) return
    closing.current = true
    el.style.transition = 'transform .26s cubic-bezier(.4, 0, .9, .6)'
    el.style.transform = `translateY(${el.offsetHeight}px)`
    if (dimRef.current) { dimRef.current.style.transition = 'opacity .26s ease'; dimRef.current.style.opacity = '0' }
    setTimeout(onClose, 240)
  }
  // крестик в заголовке окна помечен data-close — перехватываем его нажатие, чтобы сначала сыграла анимация
  const onClickCapture = (e: MouseEvent) => {
    const t = e.target as HTMLElement
    if (!t.closest('[data-close]') || t.closest('.sheet') !== ref.current) return // вложенное окно закрывается само
    e.stopPropagation()
    close()
  }

  return (
    <>
      <div className="dim" ref={dimRef} onClick={onDim ?? close} />
      <div className={'sheet' + (tall ? ' tall' : '')} ref={ref} onClickCapture={onClickCapture}>
        <div className="handle" />
        {children}
      </div>
    </>
  )
}
