import { Component, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import './ErrorBoundary.css'

// Ловит ошибку при отрисовке экрана: вместо белого экрана — сообщение и кнопки «Назад» / «Обновить»
class Boundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  componentDidCatch(err: Error) { console.error('Ошибка экрана:', err) }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="err-screen">
        <b>Что-то пошло не так</b>
        <p>Экран не смог открыться. Попробуйте вернуться назад или обновить приложение.</p>
        <div className="err-btns">
          <button onClick={() => history.back()}>Назад</button>
          <button className="pri" onClick={() => location.reload()}>Обновить</button>
        </div>
        <small>{String(this.state.err.message).slice(0, 200)}</small>
      </div>
    )
  }
}

// при переходе на другой экран ошибка сбрасывается (новый ключ — новый Boundary)
export function ErrorBoundary({ children }: { children: ReactNode }) {
  const loc = useLocation()
  return <Boundary key={loc.pathname}>{children}</Boundary>
}
