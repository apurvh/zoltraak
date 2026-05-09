import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './tests',
	fullyParallel: false,
	workers: 1,
	use: {
		baseURL: 'http://127.0.0.1:5173',
		trace: 'on-first-retry',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: {
		command: 'npm run dev -- --host 127.0.0.1',
		url: 'http://127.0.0.1:5173',
		reuseExistingServer: !process.env.CI,
	},
})
