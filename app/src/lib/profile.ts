import { tgUser } from './telegram'
import { useStore } from '../store/settings'

/** Имя и фото человека: своё (если менял в «Профиле») или из Telegram; иначе «Гость» */
export function useProfile() {
  const name = useStore((s) => s.profName)
  const photo = useStore((s) => s.profPhoto)
  const u = tgUser()
  const tgName = u ? [u.first_name, u.last_name].filter(Boolean).join(' ') : ''
  const full = name.trim() || tgName || 'Гость'
  return {
    full,
    first: name.trim() ? name.trim().split(/\s+/)[0] : u?.first_name ?? '',
    initial: (name.trim() || u?.first_name || 'А')[0].toUpperCase(),
    photo: photo || u?.photo_url || '',
    username: u?.username,
    own: !!(name.trim() || photo),
  }
}

/** Фото из галереи → квадрат 256×256, JPEG: храним сжатым в настройках */
export function resizeAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const c = document.createElement('canvas')
      c.width = c.height = 256
      c.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('не картинка')) }
    img.src = url
  })
}
