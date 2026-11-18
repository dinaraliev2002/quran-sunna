// Тарифы проверки голосом. Цены временные — окончательные после выбора модели распознавания.
// Эти же числа повторяет сервер при зачислении купленного (пакет — проверки, подписка — дни).

export interface VoicePlan {
  id: 'pack50' | 'pack150' | 'month'
  title: string
  /** что получает человек */
  desc: string
  /** цена в Telegram Stars */
  stars: number
  /** сколько проверок (пакет) */
  checks?: number
  /** на сколько дней (подписка) */
  days?: number
}

export const VOICE_FREE = 5 // бесплатных проверок на человека, один раз
export const VOICE_SUB_DAY = 20 // проверок в день по подписке

export const VOICE_PLANS: VoicePlan[] = [
  { id: 'pack50', title: '50 проверок', desc: 'Без срока: тратите, когда удобно', stars: 49, checks: 50 },
  { id: 'pack150', title: '150 проверок', desc: 'Выгоднее: ≈ 0,66 ⭐ за проверку', stars: 99, checks: 150 },
  { id: 'month', title: 'Доступ на месяц', desc: `До ${VOICE_SUB_DAY} проверок в день, 30 дней`, stars: 149, days: 30 },
]
