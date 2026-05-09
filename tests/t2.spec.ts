import { expect, test } from '@playwright/test'

test('T2: Command+K creates and switches between tldraw pages', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi)
	await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())

	const initialPageId = await page.evaluate(() => window.__zoltraakTestApi!.getCurrentPageId())

	await page.keyboard.press('Meta+K')
	await expect(page.getByRole('dialog', { name: 'Page switcher' })).toBeVisible()
	await expect(page.getByPlaceholder('Search pages...')).toBeFocused()

	await page.getByRole('option', { name: /Create new page/ }).click()

	await expect
		.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getPages().length))
		.toBe(2)

	const secondPageId = await page.evaluate(() => window.__zoltraakTestApi!.getCurrentPageId())
	expect(secondPageId).not.toBe(initialPageId)

	await page.keyboard.press('Meta+K')
	await page.getByPlaceholder('Search pages...').fill('Page 1')
	await page.keyboard.press('Enter')

	await expect
		.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getCurrentPageId()))
		.toBe(initialPageId)
})
