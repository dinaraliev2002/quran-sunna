// Крупные скачанные файлы (аудио, шрифты страниц) в приложении из магазина лежат файлами на диске телефона,
// а не в браузерном хранилище: его система может очистить при нехватке места. В Telegram и на сайте не используется.
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'

const DIR = 'downloads'
// audio: — старые загрузки по аятам (больше не используются, удаляются при запуске); sura: — записи сур целиком;
// ayah: — файлы аятов у чтецов, которые звучат аятами встык (Афаси)
const BIG = ['audio:', 'font:', 'sura:', 'ayah:']
export const useFiles = Capacitor.isNativePlatform()
export const isBig = (key: string) => useFiles && BIG.some((p) => key.startsWith(p))
const name = (key: string) => key.replace(/:/g, '__')
const unname = (n: string) => n.replace(/__/g, ':')
const path = (key: string) => `${DIR}/${name(key)}`

const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
  r.onerror = () => reject(r.error)
  r.readAsDataURL(blob)
})
const fromBase64 = (b64: string) => {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function filePut(key: string, value: unknown): Promise<boolean> {
  try {
    const blob = value instanceof Blob ? value : new Blob([value as ArrayBuffer])
    await Filesystem.writeFile({ path: path(key), data: await toBase64(blob), directory: Directory.Library, recursive: true })
    return true
  } catch { return false }
}

export async function fileGet<T>(key: string): Promise<T | undefined> {
  try {
    const r = await Filesystem.readFile({ path: path(key), directory: Directory.Library })
    const bytes = fromBase64(String(r.data))
    return (key.startsWith('audio:') ? new Blob([bytes], { type: 'audio/mpeg' }) : bytes.buffer) as T
  } catch { return undefined }
}

/** Скачать файл сразу на диск (запись суры — до 200 МБ, через память её не пропустить). onBytes — сколько скачано */
export async function downloadToFile(key: string, url: string, onBytes?: (n: number) => void): Promise<number> {
  const tmp = path(key) + '.part'
  const sub = onBytes ? await Filesystem.addListener('progress', (p) => { if (p.url === url) onBytes(p.bytes) }) : null
  try {
    await Filesystem.downloadFile({ url, path: tmp, directory: Directory.Library, recursive: true, progress: !!onBytes })
    await Filesystem.rename({ from: tmp, to: path(key), directory: Directory.Library, toDirectory: Directory.Library })
    const st = await Filesystem.stat({ path: path(key), directory: Directory.Library })
    return st.size
  } finally {
    await sub?.remove()
  }
}

/** Адрес скачанного файла для плеера (встроенный сервер приложения отдаёт его кусками — перемотка работает) */
export async function localFileUrl(key: string): Promise<string | null> {
  try {
    const { uri } = await Filesystem.getUri({ path: path(key), directory: Directory.Library })
    await Filesystem.stat({ path: path(key), directory: Directory.Library })
    return Capacitor.convertFileSrc(uri)
  } catch { return null }
}

export async function fileHas(key: string): Promise<boolean> {
  try { await Filesystem.stat({ path: path(key), directory: Directory.Library }); return true } catch { return false }
}

export async function fileList(prefix: string): Promise<{ key: string; size: number }[]> {
  try {
    const r = await Filesystem.readdir({ path: DIR, directory: Directory.Library })
    return r.files.map((f) => ({ key: unname(f.name), size: f.size ?? 0 })).filter((f) => f.key.startsWith(prefix) && !f.key.endsWith('.part'))
  } catch { return [] }
}

export async function fileDeletePrefix(prefix: string) {
  for (const f of await fileList(prefix)) {
    try { await Filesystem.deleteFile({ path: path(f.key), directory: Directory.Library }) } catch { /* уже нет */ }
  }
}
