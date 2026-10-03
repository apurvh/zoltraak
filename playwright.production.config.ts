import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './tests',
	testMatch: /production\.spec\.ts/,
	workers: 1,
	use: { baseURL: 'http://127.0.0.1:4173', trace: 'on-first-retry' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'npm exec vite preview -- --config vite.config.ts --host 127.0.0.1 --port 4173 --strictPort',
		url: 'http://127.0.0.1:4173',
		reuseExistingServer: false,
	},
})
