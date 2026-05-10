import { expect, test } from '@playwright/test'

declare global {
	interface Window {
		__zoltraakStorageOpenAttempts?: number
	}
}

test('storage load failure falls back to a blank document', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(window, 'indexedDB', {
			configurable: true,
			value: undefined,
		})
	})

	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi)

	await expect
		.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getCurrentPageId()))
		.not.toBe('')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getPages().length)).toBe(1)
})

test('autosave keeps trying after a transient storage failure', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi)
	await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())
	await page.evaluate(() => {
		const originalOpen = window.indexedDB.open.bind(window.indexedDB)
		let shouldFail = true
		window.__zoltraakStorageOpenAttempts = 0
		Object.defineProperty(window.indexedDB, 'open', {
			configurable: true,
			value: (...args: Parameters<IDBFactory['open']>) => {
				window.__zoltraakStorageOpenAttempts = (window.__zoltraakStorageOpenAttempts ?? 0) + 1
				if (shouldFail) {
					shouldFail = false
					throw new DOMException('forced storage failure', 'InvalidStateError')
				}

				return originalOpen(...args)
			},
		})
	})

	await page.keyboard.press('r')
	await page.mouse.move(220, 180)
	await page.mouse.down()
	await page.mouse.move(420, 320)
	await page.mouse.up()
	await page.keyboard.press('r')
	await page.mouse.move(450, 180)
	await page.mouse.down()
	await page.mouse.move(620, 320)
	await page.mouse.up()

	await expect
		.poll(() => page.evaluate(() => window.__zoltraakStorageOpenAttempts ?? 0))
		.toBeGreaterThan(1)
})
