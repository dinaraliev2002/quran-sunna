import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// последняя новость «Что нового» на момент сборки — чтобы приложение поняло, что на сайте уже есть версия новее
const newsLatest = JSON.parse(readFileSync(new URL('./public/updates.json', import.meta.url), 'utf8')).items[0]?.id ?? ''

// base './' — чтобы сайт работал из любой папки хостинга (GitHub Pages, Cloudflare Pages и т.п.)
export default defineConfig({
  base: './',
  plugins: [react()],
  define: { __NEWS_LATEST__: JSON.stringify(newsLatest) },
  // адреса временного туннеля Cloudflare (для проверки в Telegram с компьютера)
  server: { allowedHosts: ['.trycloudflare.com'] },
  preview: { allowedHosts: ['.trycloudflare.com'] },
})
