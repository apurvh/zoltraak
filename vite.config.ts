import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { offline } from './build/offline'

// Expose the built chunk URL so a failed module fetch can be retried at a fresh URL.
const editorUrlModule = 'virtual:mermaid-editor-url'
export default defineConfig(({ command }) => ({
	plugins: [react(), offline(), {
		name: 'mermaid-editor-url',
		resolveId(id) {
			if (id === editorUrlModule) return '\0' + id
		},
		load(id) {
			if (id !== '\0' + editorUrlModule) return
			if (command === 'serve') return "export default import.meta.env.BASE_URL + 'src/components/MermaidEditor.tsx'"
			const ref = this.emitFile({
				type: 'chunk',
				id: fileURLToPath(new URL('./src/components/MermaidEditor.tsx', import.meta.url)),
				preserveSignature: 'strict',
			})
			return `export default import.meta.ROLLUP_FILE_URL_${ref}`
		},
	}],
}))
