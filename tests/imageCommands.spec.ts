import { expect, test } from '@playwright/test'

test('Command-K exposes image shortcuts and keyboard filtering/insertion', async ({ page }, testInfo) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await page.keyboard.press('Meta+K')
	await expect(page.getByText('Images', { exact: true })).toBeVisible()
	for (const [label, key] of [['Stick User', 'S'], ['Database', 'D'], ['Queue', 'Q'], ['Cache', 'C']]) {
		await expect(page.getByRole('option', { name: label, exact: true }).locator('kbd')).toHaveText(key)
		await expect(page.getByRole('option', { name: label, exact: true })).toHaveAttribute('aria-keyshortcuts', key)
	}
	await expect(page.getByRole('option', { name: 'Stick Admin', exact: true }).locator('kbd')).toHaveCount(0)
	await page.screenshot({ path: testInfo.outputPath('image-shortcuts.png') })
	const input = page.getByPlaceholder('Search pages...')
	await input.fill('stick')
	await expect(page.getByRole('option', { name: 'Database', exact: true })).toHaveCount(0)
	await expect(page.getByRole('option', { name: 'Stick User', exact: true })).toHaveAttribute('aria-selected', 'true')
	await page.keyboard.press('ArrowDown')
	await expect(page.getByRole('option', { name: 'Stick Admin', exact: true })).toHaveAttribute('aria-selected', 'true')
	await page.keyboard.press('ArrowUp')
	await page.keyboard.press('Enter')
	await expect(page.getByRole('dialog')).toHaveCount(0)
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().some((s) => s.props.fileId === 'default-image-stick-user'))).toBe(true)
	await page.keyboard.press('Meta+K')
	await input.fill('db storage')
	await expect(page.getByRole('option', { name: 'Database', exact: true })).toBeVisible()
	await page.keyboard.press('Enter')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().some((s) => s.props.fileId === 'default-image-database'))).toBe(true)
})
