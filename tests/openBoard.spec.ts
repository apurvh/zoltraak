import { expect, test } from '@playwright/test'

test('a failed read leaves saved drawings intact and can be retried', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await page.keyboard.press('Meta+k')
	await page.getByRole('textbox', { name: 'Search pages' }).fill('Interview')
	await page.getByRole('option', { name: /Create new page/ }).click()
	await page.keyboard.press('Meta+k')
	await page.getByRole('option', { name: 'Database', exact: true }).click()
	const id = await page.evaluate(() => window.__zoltraakTestApi!.getCurrentPageId())
	await expect.poll(() => page.evaluate(async () => {
		const modulePath = '/src/lib/document.ts'
		const { loadDocument, getCurrentPage } = await import(modulePath)
		return getCurrentPage(await loadDocument()).elements.length
	})).toBe(2)

	const errors: string[] = []
	page.on('pageerror', error => errors.push(error.message))
	await page.addInitScript(() => {
		const get = IDBObjectStore.prototype.get
		IDBObjectStore.prototype.get = function (...args) {
			if (this.name === 'documents' && this.transaction.mode === 'readonly' && !sessionStorage.allowRead) {
				const request = get.apply(this, args)
				this.transaction.abort()
				return request
			}
			return get.apply(this, args)
		}
	})
	await page.reload()
	await expect(page.getByRole('alert')).toContainText('Couldn’t open your saved drawings')
	await expect(page.locator('canvas.interactive')).toHaveCount(0)

	await page.evaluate(() => { sessionStorage.allowRead = '1' })
	await page.getByRole('button', { name: 'Try again' }).click()
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi?.getShapes().length)).toBe(2)
	expect(await page.evaluate(() => window.__zoltraakTestApi!.getCurrentPageId())).toBe(id)
	expect(await page.evaluate(() => window.__zoltraakTestApi!.getPages().length)).toBe(2)
	expect(errors).toEqual([])
})

test('a blocked upgrade explains how to continue and opens the board when unblocked', async ({ context, page }) => {
	const oldTab = await context.newPage()
	await oldTab.route('**/old-version', route => route.fulfill({ contentType: 'text/html', body: '<title>Old version</title>' }))
	await oldTab.goto('/old-version')
	await oldTab.evaluate(() => new Promise<void>((resolve, reject) => {
		const request = indexedDB.open('zoltraak', 1)
		request.onupgradeneeded = () => request.result.createObjectStore('documents')
		request.onsuccess = () => {
			// An older tab can hold its connection open across an update.
			Object.assign(window, { oldConnection: request.result })
			resolve()
		}
		request.onerror = () => reject(request.error)
	}))

	await page.goto('/')
	await expect(page.getByRole('status').filter({ hasText: 'Close other Zoltraak tabs' })).toBeVisible()
	await expect(page.locator('canvas.interactive')).toHaveCount(0)
	await oldTab.close()
	await expect(page.locator('canvas.interactive')).toBeVisible()
})
