import { Icon } from '../../components/Icon'
import { Sheet, SheetHead } from '../../components/ui'
import { VOICE_PLANS, VOICE_SUB_DAY } from '../../lib/voicePlans'
import type { VoiceAccessInfo } from '../../lib/voiceApi'
import { useVoiceAccess } from '../../store/voiceAccess'

const date = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

/** Что осталось у человека — одной строкой (пустая, пока платный доступ не включён или ответа ещё нет) */
export function accessNote(a: VoiceAccessInfo): string {
  if (!a.paywall || a.vip) return ''
  const sub = a.sub_until && new Date(a.sub_until) > new Date()
  if (sub) return `Подписка до ${date(a.sub_until!)} · сегодня осталось проверок: ${a.day_left ?? 0}` + (a.credits ? ` · в пакете: ${a.credits}` : '')
  if (a.credits) return `Проверок в пакете: ${a.credits}`
  if (a.free_left) return `Бесплатных проверок осталось: ${a.free_left}`
  return ''
}

/** Окно «оформите подписку»: что осталось, тарифы. Оплата подключается отдельно (Telegram Stars, магазины приложений) */
export function VoicePaywall({ onClose }: { onClose: () => void }) {
  const a = useVoiceAccess((s) => s.info)
  const note = accessNote(a)
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="Проверка голосом" sub={note || 'Бесплатные проверки закончились'} onClose={onClose} />
      <div className="hz-pay">
        <p className="hz-pay-lead"><Icon id="lock" />Приложение слушает, как вы читаете наизусть, и показывает ошибки в каждом слове. Чтобы продолжить, выберите пакет или подписку.</p>
        <div className="hz-pay-list">
          {VOICE_PLANS.map((p) => (
            <div key={p.id} className={'hz-pay-card' + (p.id === 'month' ? ' main' : '')}>
              <div><b>{p.title}</b><small>{p.desc}</small></div>
              <button className="hz-pay-buy" disabled>{p.stars} ⭐</button>
            </div>
          ))}
        </div>
        <p className="hz-pay-note">Оплата подключается — скоро. Системное распознавание речи (в настройках проверки голосом) работает бесплатно, но менее точно, особенно по-арабски. По подписке — до {VOICE_SUB_DAY} проверок в день.</p>
        <button className="bigbtn" onClick={onClose}>Понятно</button>
      </div>
    </Sheet>
  )
}
