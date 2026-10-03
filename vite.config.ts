import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { offline } from './build/offline'

export default defineConfig({
	plugins: [react(), offline()],
})
