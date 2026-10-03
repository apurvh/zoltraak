import { expect, test } from '@playwright/test'

test('reload, drawing, local fonts and first Mermaid use work without internet', async ({ page, context }) => {
	test.setTimeout(60_000)
	const externalRequests: string[] = []
	page.on('pageerror', (error) => console.log('Offline page error:', error.message))
	page.on('requestfailed', (request) => console.log('Offline request failed:', request.url(), request.failure()?.errorText))
	page.on('request', (request) => {
		if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') externalRequests.push(request.url())
	})
	await page.goto('/')
	await expect(page.locator('canvas.interactive')).toBeVisible()
	await page.evaluate(() => navigator.serviceWorker.ready)
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
	await context.setOffline(true)
	await page.reload()
	await expect(page.locator('canvas.interactive')).toBeVisible()
	await page.keyboard.press('r')
	await page.mouse.move(220, 180)
	await page.mouse.down()
	await page.mouse.move(420, 320)
	await page.mouse.up()
	await page.keyboard.press('t')
	await page.mouse.click(480, 220)
	await page.keyboard.type('Offline text')
	await page.keyboard.press('Escape')
	await page.evaluate(() => document.fonts.ready)
	expect(await page.evaluate(() => document.fonts.check('20px Excalifont'))).toBe(true)
	await page.keyboard.press('Meta+K')
	await page.getByRole('option', { name: /Insert Mermaid diagram/ }).click()
	await expect(page.getByRole('button', { name: /^Insert/ })).toBeEnabled()
	await page.getByRole('button', { name: /^Insert/ }).click()
	await expect(page.getByRole('dialog', { name: 'Mermaid editor' })).not.toBeVisible()
	await expect.poll(() => page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve) => {
			const request = indexedDB.open('zoltraak')
			request.onsuccess = () => resolve(request.result)
		})
		const metadata = await new Promise<any>((resolve) => {
			const request = db.transaction('documents').objectStore('documents').get('zoltraak-canvas')
			request.onsuccess = () => resolve(request.result)
		})
		const result = await new Promise<any>((resolve) => {
			const request = db.transaction('pages').objectStore('pages').get(metadata.currentPageId)
			request.onsuccess = () => resolve(request.result)
		})
		db.close()
		return result.elements.filter((element: any) => !element.isDeleted).length
	})).toBe(3)
	await page.reload()
	await expect(page.locator('canvas.interactive')).toBeVisible()
	expect(externalRequests).toEqual([])
})

test('production startup fits the script and time budgets', async ({ browser }, testInfo) => {
	const samples: Array<{ readyMs: number; scriptBytes: number }> = []
	for (let index = 0; index < 3; index += 1) {
		const context = await browser.newContext({ baseURL: String(testInfo.project.use.baseURL) })
		const page = await context.newPage()
		await page.goto('/')
		await expect(page.locator('canvas.interactive')).toBeVisible()
		const sample = await page.evaluate(() => ({
			readyMs: performance.now(),
			scriptBytes: performance.getEntriesByType('resource')
				.filter((entry) => new URL(entry.name).pathname.endsWith('.js'))
				.reduce((total, entry) => total + (entry as PerformanceResourceTiming).decodedBodySize, 0),
		}))
		samples.push(sample)
		await context.close()
	}
	const metrics = {
		medianReadyMs: samples.map((sample) => sample.readyMs).sort((a, b) => a - b)[1],
		maxScriptBytes: Math.max(...samples.map((sample) => sample.scriptBytes)),
		samples,
	}
	console.log('Production startup:', JSON.stringify(metrics))
	await testInfo.attach('startup-performance', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' })
	if (!process.env.PERFORMANCE_BASELINE) {
		expect(metrics.maxScriptBytes).toBeLessThan(1_500_000)
		expect(metrics.medianReadyMs).toBeLessThan(2000)
	}
})
