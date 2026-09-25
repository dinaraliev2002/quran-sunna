import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' — чтобы сайт работал из любой папки хостинга (GitHub Pages, Cloudflare Pages и т.п.)
export default defineConfig({
  base: './',
  plugins: [react()],
  // адреса временного туннеля Cloudflare (для проверки в Telegram с компьютера)
  server: { allowedHosts: ['.trycloudflare.com'] },
  preview: { allowedHosts: ['.trycloudflare.com'] },
})
