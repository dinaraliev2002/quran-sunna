import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet, SheetHead } from '../../components/ui'
import { VOICE_PLANS, VOICE_SUB_DAY } from '../../lib/voicePlans'
import { createInvoice, type VoiceAccessInfo } from '../../lib/voiceApi'
import { canPayStars, haptic, payInvoice } from '../../lib/telegram'
import { useVoiceAccess } from '../../store/voiceAccess'

const date = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

/** Что осталось у человека — одной строкой (пустая, пока платный доступ не включён или ответа ещё нет) */
export function accessNote(a: VoiceAccessInfo): string {
  if (!a.paywall || a.vip) return ''
  const sub = a.sub_until && new Date(a.sub_until) > new Date()
  if (sub) return `Доступ до ${date(a.sub_until!)} · сегодня осталось проверок: ${a.day_left ?? 0}` + (a.credits ? ` · в пакете: ${a.credits}` : '')
  if (a.credits) return `Проверок в пакете: ${a.credits}`
  if (a.free_left) return `Бесплатных проверок осталось: ${a.free_left}`
  return ''
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Окно «оформите подписку»: что осталось, тарифы, оплата звёздами Telegram. В браузере и в магазинных приложениях оплата подключается позже */
export function VoicePaywall({ onClose }: { onClose: () => void }) {
  const a = useVoiceAccess((s) => s.info)
  const note = accessNote(a)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const stars = canPayStars()

  const buy = async (id: string) => {
    haptic.tap()
    setBusy(id); setMsg('')
    try {
      const st = await payInvoice(await createInvoice(id))
      if (st === 'paid' || st === 'pending') {
        setMsg('Оплата прошла — подключаю проверки…')
        // бот начисляет по сообщению от Telegram — это занимает секунды
        for (let i = 0; i < 10; i++) { await wait(1500); await useVoiceAccess.getState().load(); const n = useVoiceAccess.getState().info; if (n.can) break }
        if (useVoiceAccess.getState().info.can) { onClose(); return }
        setMsg('Оплата получена. Начисление задерживается — закройте окно и зайдите чуть позже.')
      } else if (st === 'failed') setMsg('Оплата не прошла. Попробуйте ещё раз.')
    } catch (e) { setMsg((e as Error).message || 'Не удалось открыть оплату') }
    finally { setBusy('') }
  }

  return (
    <Sheet onClose={onClose}>
      <SheetHead title="Проверка голосом" sub={note || 'Бесплатные проверки закончились'} onClose={onClose} />
      <div className="hz-pay">
        <p className="hz-pay-lead"><Icon id="lock" />Приложение слушает, как вы читаете наизусть, и показывает ошибки в каждом слове. Чтобы продолжить, выберите пакет или доступ на месяц.</p>
        <div className="hz-pay-list">
          {VOICE_PLANS.map((p) => (
            <div key={p.id} className={'hz-pay-card' + (p.id === 'month' ? ' main' : '')}>
              <div><b>{p.title}</b><small>{p.desc}</small></div>
              <button className="hz-pay-buy" disabled={!stars || !!busy} onClick={() => buy(p.id)}>{busy === p.id ? '…' : `${p.stars} ⭐`}</button>
            </div>
          ))}
        </div>
        {msg && <p className="hz-pay-msg">{msg}</p>}
        <p className="hz-pay-note">{stars ? 'Оплата звёздами Telegram. Вопросы по оплате и возврат — в боте, команда /paysupport. ' : 'Оплата сейчас доступна в Telegram; в браузере и в приложении из магазина — скоро. '}Системное распознавание речи (в настройках проверки голосом) работает бесплатно, но менее точно, особенно по-арабски. По доступу на месяц — до {VOICE_SUB_DAY} проверок в день.</p>
        <button className="bigbtn" onClick={onClose}>Закрыть</button>
      </div>
    </Sheet>
  )
}
