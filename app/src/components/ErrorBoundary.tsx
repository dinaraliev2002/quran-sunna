import { Component, type ReactNode } from 'react'
import './ErrorBoundary.css'

// Ловит ошибку при отрисовке экрана: вместо белого экрана — сообщение и кнопки «Назад» / «Обновить».
// resetKey — адрес экрана: при его смене ошибка сбрасывается (без пересоздания экрана, чтобы он не терял состояние)
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  componentDidCatch(err: Error) { console.error('Ошибка экрана:', err) }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.err && prev.resetKey !== this.props.resetKey) this.setState({ err: null })
  }
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
