import { useEffect, useRef, type RefObject } from 'react'
import type { ReadMode } from '../types/settings'

/**
 * «Продолжить чтение»: аят, на котором остановились, на пару секунд подсвечивается (в любом режиме).
 * hl — подсветить; без hl в «Странице» только докручиваем до аята. Первый аят суры, которая начинается посередине страницы
 * (86 и 87 на стр. 591), докручиваем к заголовку суры — иначе открываешь «Аль-Аля», а видишь начало «Ат-Тарик». appScrollUntil — отметка, что прокрутку делает приложение.
 */
export function useFlashAyah(hl: boolean, mode: ReadMode, surah: number, ayah: number, appScrollUntil: RefObject<number>) {
  const flashed = useRef(false)
  useEffect(() => {
    if (flashed.current || (!hl && mode !== 'page')) return
    const key = `${surah}:${ayah}`
    let tries = 0, seen = 0
    const t = setInterval(() => {
      // ждём, пока аят реально появится на экране (в «Странице» открывается сначала первая страница суры, потом нужная)
      const els = [...document.querySelectorAll<HTMLElement>(`.view [data-key="${key}"], .view [data-k="${key}"]`)]
      const shown = els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > 0 && r.left < window.innerWidth })
      if (!shown.length) { if (++tries > 40) clearInterval(t); seen = 0; return }
      if (++seen < 2) return // дали странице устояться
      clearInterval(t)
      flashed.current = true
      if (mode === 'page' && ayah === 1) {
        // сура начинается с заголовка (баннер, «О суре») — показываем его сверху, если он не уже наверху страницы
        const box = shown[0].closest<HTMLElement>('.pscroll')
        const head = shown[0].parentElement
        if (box && head) {
          const delta = head.getBoundingClientRect().top - box.getBoundingClientRect().top
          if (delta > 150) { appScrollUntil.current = Date.now() + 1200; box.scrollTop += delta - 130 }
        }
      } else if (mode !== 'mushaf') { appScrollUntil.current = Date.now() + 1200; shown[0].scrollIntoView({ block: 'center' }) }
      if (!hl) return
      shown.forEach((e) => e.classList.add('flash'))
      // страница могла перерисоваться — пока подсветка идёт, возвращаем её на новые элементы
      const keep = setInterval(() => document.querySelectorAll(`.view [data-key="${key}"], .view [data-k="${key}"]`).forEach((e) => e.classList.add('flash')), 300)
      setTimeout(() => { clearInterval(keep); document.querySelectorAll('.flash').forEach((e) => e.classList.remove('flash')) }, 2600)
    }, 250)
    return () => clearInterval(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- только при открытии читалки
}
