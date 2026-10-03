import { expect, test } from '@playwright/test'

declare global {
	interface Window {
		__zoltraakStorageWriteAttempts?: number
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
		const originalPut = IDBObjectStore.prototype.put
		let shouldFail = true
		window.__zoltraakStorageWriteAttempts = 0
		IDBObjectStore.prototype.put = function (...args) {
				window.__zoltraakStorageWriteAttempts = (window.__zoltraakStorageWriteAttempts ?? 0) + 1
				if (shouldFail) {
					shouldFail = false
					throw new DOMException('forced storage failure', 'InvalidStateError')
				}

				return originalPut.apply(this, args)
		}
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
		.poll(() => page.evaluate(() => window.__zoltraakStorageWriteAttempts ?? 0))
		.toBeGreaterThan(1)
})

test('stale tabs sync and do not overwrite drawings saved from another tab', async ({ context, page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi)
	await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())

	const staleTab = await context.newPage()
	await staleTab.goto('/')
	await staleTab.waitForFunction(() => window.__zoltraakTestApi)

	await page.keyboard.press('r')
	await page.mouse.move(220, 180)
	await page.mouse.down()
	await page.mouse.move(420, 320)
	await page.mouse.up()

	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(1)

	await staleTab.bringToFront()
	await expect
		.poll(() => staleTab.evaluate(() => window.__zoltraakTestApi!.getShapes().length))
		.toBe(1)

	await staleTab.keyboard.press('r')

	await expect.poll(() => staleTab.evaluate(() => window.__zoltraakTestApi!.getCurrentToolId())).toBe('rectangle')

	const reloadTab = await context.newPage()
	await reloadTab.goto('/')
	await reloadTab.waitForFunction(() => window.__zoltraakTestApi)

	await expect
		.poll(() => reloadTab.evaluate(() => window.__zoltraakTestApi!.getShapes().length))
		.toBe(1)
})

test('existing version-one drawings and images migrate without losing data', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())
	await page.keyboard.press('r')
	await page.mouse.move(220, 180)
	await page.mouse.down()
	await page.mouse.move(420, 320)
	await page.mouse.up()
	const shape = await page.evaluate(() => window.__zoltraakTestApi!.getShapes()[0].props)
	await page.route('**/legacy-fixture', (route) => route.fulfill({ contentType: 'text/html', body: '<html></html>' }))
	await page.goto('/legacy-fixture')
	const legacy = {
		schemaVersion: 1, updatedAt: 100, currentPageId: 'legacy',
		pages: [{ id: 'legacy', name: 'My old drawing', updatedAt: 100, elements: [shape], appState: {},
			files: { legacyImage: { id: 'legacyImage', dataURL: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', mimeType: 'image/svg+xml', created: 1 } },
		}],
	}
	await page.evaluate(async (document) => {
		await new Promise<void>((resolve) => { indexedDB.deleteDatabase('zoltraak').onsuccess = () => resolve() })
		const db = await new Promise<IDBDatabase>((resolve) => {
			const request = indexedDB.open('zoltraak', 1)
			request.onupgradeneeded = () => request.result.createObjectStore('documents')
			request.onsuccess = () => resolve(request.result)
		})
		const transaction = db.transaction('documents', 'readwrite')
		transaction.objectStore('documents').put(document, 'zoltraak-canvas')
		await new Promise<void>((resolve) => { transaction.oncomplete = () => resolve() })
		db.close()
	}, legacy)
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getShapes().length === 1)
	expect(await page.evaluate(() => window.__zoltraakTestApi!.getPages()[0].name)).toBe('My old drawing')
	const stored = await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve) => {
			const request = indexedDB.open('zoltraak')
			request.onsuccess = () => resolve(request.result)
		})
		const get = (store: string, key: IDBValidKey) => new Promise<any>((resolve) => {
			const request = db.transaction(store).objectStore(store).get(key)
			request.onsuccess = () => resolve(request.result)
		})
		const result = { metadata: await get('documents', 'zoltraak-canvas'), file: await get('files', ['legacy', 'legacyImage']), version: db.version }
		db.close()
		return result
	})
	expect(stored.version).toBe(2)
	expect(stored.metadata.pages).toBeUndefined()
	expect(stored.file.file.dataURL).toBe(legacy.pages[0].files.legacyImage.dataURL)
	await page.reload()
	await page.waitForFunction(() => window.__zoltraakTestApi?.getShapes().length === 1)
})
