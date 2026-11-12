import { expect, test, type Page } from '@playwright/test'

function warning(page: Page) {
	return page.getByText('Another tab has this canvas open.', { exact: false })
}

test('idle tabs warn each other until only one stays open', async ({ context, page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await expect(warning(page)).toBeHidden()

	const secondTab = await context.newPage()
	await secondTab.goto('/')
	await expect(warning(page)).toBeVisible()
	await expect(warning(secondTab)).toBeVisible()

	const thirdTab = await context.newPage()
	await thirdTab.goto('/')
	await expect(warning(thirdTab)).toBeVisible()
	await secondTab.close()
	await expect(warning(page)).toBeVisible()
	await expect(warning(thirdTab)).toBeVisible()

	await thirdTab.close()
	await expect(warning(page)).toBeHidden()
})

test('a peer that disappears without a close message expires', async ({ page }) => {
	await page.clock.install()
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await page.evaluate(() => {
		const peer = new BroadcastChannel('zoltraak-tab-presence')
		peer.postMessage({ type: 'hello', tabId: 'lost-tab' })
		peer.close()
	})
	await expect(warning(page)).toBeVisible()
	await page.clock.fastForward(4 * 60_000)
	await expect(warning(page)).toBeHidden()
})
