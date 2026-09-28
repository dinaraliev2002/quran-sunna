import { create } from 'zustand'

// Состояние интерфейса, которое не сохраняется: текущая (уже вычисленная) тема
export const useUi = create<{ theme: 'light' | 'dark' }>(() => ({ theme: 'dark' }))
