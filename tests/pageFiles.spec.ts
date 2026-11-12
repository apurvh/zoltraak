import { expect, test, type Page } from '@playwright/test'

async function storedFileKeys(page: Page) {
	return page.evaluate(() => new Promise<IDBValidKey[]>((resolve, reject) => {
		const open = indexedDB.open('zoltraak')
		open.onerror = () => reject(open.error)
		open.onsuccess = () => {
			const db = open.result
			const get = db.transaction('files').objectStore('files').getAllKeys()
			get.onerror = () => reject(get.error)
			get.onsuccess = () => resolve(get.result)
			db.close()
		}
	}))
}

test('each page saves its own images through undo, page switches and reload', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	const firstPageId = await page.evaluate(() => window.__zoltraakTestApi!.getCurrentPageId())
	const imageId = 'default-image-stick-user'
	await page.keyboard.press('s')
	await page.mouse.click(420, 250)
	await expect.poll(() => storedFileKeys(page)).toEqual([[firstPageId, imageId]])
	await page.getByRole('button', { name: 'Undo', exact: true }).click()
	await expect.poll(() => storedFileKeys(page)).toEqual([])
	await page.getByRole('button', { name: 'Redo', exact: true }).click()
	await expect.poll(() => storedFileKeys(page)).toEqual([[firstPageId, imageId]])

	await page.keyboard.press('Meta+k')
	await page.getByRole('option', { name: /Create new page/ }).click()
	const nextPageId = await page.evaluate(() => window.__zoltraakTestApi!.getCurrentPageId())
	await page.keyboard.press('d')
	await page.mouse.click(480, 300)
	const expected = [[firstPageId, imageId], [nextPageId, 'default-image-database']].sort()
	await expect.poll(() => storedFileKeys(page)).toEqual(expected)
	await page.keyboard.press('Meta+k')
	await page.getByPlaceholder('Search pages...').fill('Page 1')
	await page.keyboard.press('Enter')
	await page.reload()
	await expect.poll(() => page.evaluate(() =>
		window.__zoltraakTestApi?.getShapes().map((shape) => shape.props.fileId)
	)).toEqual([imageId])
	await expect.poll(() => storedFileKeys(page)).toEqual(expected)
})

type ImagePage = { id: string; drawsImage?: boolean; color?: string }

async function seedImageBoard(page: Page, pages: ImagePage[], currentPageId: string) {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await page.keyboard.press('s')
	await page.mouse.click(420, 250)
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId() === 'selection' &&
		window.__zoltraakTestApi.getShapes().some(shape => shape.type === 'image' && Number(shape.props.width) > 0))
	const shape = await page.evaluate(() => window.__zoltraakTestApi!.getShapes()[0].props)
	await page.route('**/old-tab', route => route.fulfill({ contentType: 'text/html', body: '<title>Older tab</title>' }))
	await page.goto('/old-tab')
	// The handle keeps the original file objects alive in this tab while another opens the board.
	return page.evaluateHandle(async ({ pages, currentPageId, shape }) => {
		function makeFile(color: string) {
			const canvas = document.createElement('canvas')
			canvas.width = canvas.height = 2
			const context = canvas.getContext('2d')!
			context.fillStyle = color
			context.fillRect(0, 0, 2, 2)
			return { id: 'diagram', dataURL: canvas.toDataURL(), mimeType: 'image/png', created: 1 }
		}
		const board = {
			schemaVersion: 1, updatedAt: 100, currentPageId,
			pages: pages.map(({ id, color, drawsImage }) => ({
				id, name: id, updatedAt: 100, appState: {},
				elements: drawsImage ? [{ ...shape, id: id + '-image', fileId: 'diagram' }] : [],
				files: color ? { diagram: makeFile(color) } : {},
			})),
		}
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const open = indexedDB.open('zoltraak')
			open.onsuccess = () => resolve(open.result)
			open.onerror = () => reject(open.error)
		})
		const tx = db.transaction(['documents', 'pages', 'files'], 'readwrite')
		const files = tx.objectStore('files')
		const rows = tx.objectStore('pages')
		files.clear()
		rows.clear()
		for (const { files: pageFiles, ...row } of board.pages) {
			rows.put(row, row.id)
			if (pageFiles.diagram) files.put({ pageId: row.id, file: pageFiles.diagram }, [row.id, 'diagram'])
		}
		const { pages: savedPages, ...metadata } = board
		tx.objectStore('documents').put({ ...metadata, pageIds: savedPages.map(row => row.id) }, 'zoltraak-canvas')
		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve()
			tx.onabort = () => reject(tx.error)
		})
		db.close()
		return board
	}, { pages, currentPageId, shape })
}

async function storedImage(page: Page, pageId: string) {
	return page.evaluate((pageId) => new Promise<string | null>((resolve, reject) => {
		const open = indexedDB.open('zoltraak')
		open.onerror = () => reject(open.error)
		open.onsuccess = () => {
			const get = open.result.transaction('files').objectStore('files').get([pageId, 'diagram'])
			get.onsuccess = () => resolve(get.result?.file.dataURL ?? null)
			get.onerror = () => reject(get.error)
			open.result.close()
		}
	}), pageId)
}

async function switchPage(page: Page, name: string) {
	await page.keyboard.press('Meta+k')
	await page.getByRole('textbox', { name: 'Search pages' }).fill(name)
	await page.keyboard.press('Enter')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi?.getCurrentPageId())).toBe(name)
}

async function openBoard(page: Page) {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
}

test('an older open tab can use its saved image after another tab opens the board', async ({ page: oldTab, context }) => {
	const previous = await seedImageBoard(oldTab, [
		{ id: 'Source', drawsImage: true, color: 'red' }, { id: 'Target', color: 'red' },
	], 'Target')
	const bytes = await previous.evaluate(board => board.pages[1].files.diagram!.dataURL)
	const newTab = await context.newPage()
	await openBoard(newTab)
	await expect.poll(() => newTab.evaluate(() => window.__zoltraakTestApi?.getCurrentPageId())).toBe('Target')

	const fileWrites = await previous.evaluate(async (old) => {
		const { saveDocument } = await import('/src/lib/document.ts' as string)
		const timestamp = Date.now()
		const target = { ...old.pages[1], updatedAt: timestamp, elements: [{ ...old.pages[0].elements[0], id: 'new-image' }] }
		const next = { ...old, updatedAt: timestamp, pages: [old.pages[0], target] }
		// This is the older writer's fast path: the new shape uses the same file object it already saved.
		const put = IDBObjectStore.prototype.put
		let count = 0
		IDBObjectStore.prototype.put = function (...args) {
			if (this.name === 'files') count++
			return put.apply(this, args)
		}
		try {
			await saveDocument(next, old)
			return count
		} finally {
			IDBObjectStore.prototype.put = put
		}
	})
	expect(fileWrites).toBe(0)
	expect(await storedImage(oldTab, 'Target')).toBe(bytes)
	await newTab.reload()
	await expect.poll(() => newTab.evaluate(() => window.__zoltraakTestApi?.getShapes().map(shape => shape.id))).toEqual(['new-image'])
	expect(await storedImage(newTab, 'Target')).toBe(bytes)
})

test('a previously pruned image is restored on disk and survives removal of its only source', async ({ page }) => {
	const snapshot = await seedImageBoard(page, [
		{ id: 'Source', drawsImage: true, color: 'red' }, { id: 'Target', drawsImage: true },
	], 'Target')
	const bytes = await snapshot.evaluate(board => board.pages[0].files.diagram!.dataURL)
	expect(await storedImage(page, 'Target')).toBeNull()
	await openBoard(page)
	await expect.poll(() => storedImage(page, 'Target')).toBe(bytes)
	await switchPage(page, 'Source')
	await page.mouse.click(420, 250)
	await page.keyboard.press('Backspace')
	await expect.poll(() => storedImage(page, 'Source')).toBeNull()
	await switchPage(page, 'Target')
	await page.reload()
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi?.getShapes().map(shape => shape.id))).toEqual(['Target-image'])
	expect(await storedImage(page, 'Target')).toBe(bytes)
})

test('switching and editing keeps local image bytes and leaves conflicting sources unresolved', async ({ page }) => {
	const snapshot = await seedImageBoard(page, [
		{ id: 'Red', drawsImage: true, color: 'red' }, { id: 'Blue', drawsImage: true, color: 'blue' },
		{ id: 'Missing', drawsImage: true },
	], 'Red')
	const expected = await snapshot.evaluate(board => board.pages.map(row => row.files.diagram?.dataURL ?? null))
	const pixelAtImageCenter = () => page.locator('canvas.static').evaluate((node) => {
		const canvas = node as HTMLCanvasElement
		const api = window.__zoltraakTestApi!
		const shape = api.getShapes().find(shape => shape.type === 'image')
		if (!shape || !canvas.width) return null
		const app = api.getAppState()
		const { x, y, width, height } = shape.props
		const px = (Number(x) + Number(width) / 2 + app.scrollX) * app.zoom.value * canvas.width / canvas.clientWidth
		const py = (Number(y) + Number(height) / 2 + app.scrollY) * app.zoom.value * canvas.height / canvas.clientHeight
		return [...canvas.getContext('2d')!.getImageData(px, py, 1, 1).data].slice(0, 3).join(',')
	})
	await openBoard(page)
	await expect.poll(pixelAtImageCenter).toBe('255,0,0')
	for (const id of ['Blue', 'Missing']) {
		await switchPage(page, id)
		if (id === 'Blue') await expect.poll(pixelAtImageCenter).toBe('0,0,255')
		await page.keyboard.press('r')
		await page.mouse.move(650, 280)
		await page.mouse.down()
		await page.mouse.move(750, 360)
		await page.mouse.up()
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi?.getShapes().map(shape => shape.type))).toEqual(['image', 'rectangle'])
		if (id === 'Missing') expect(['255,0,0', '0,0,255']).not.toContain(await pixelAtImageCenter())
		await page.reload()
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi?.getShapes().map(shape => shape.type))).toEqual(['image', 'rectangle'])
	}
	expect(await Promise.all(['Red', 'Blue', 'Missing'].map(id => storedImage(page, id)))).toEqual(expected)
})

test('a full store still opens the board and image recovery retries on the next load', async ({ page }) => {
	const board = await seedImageBoard(page, [
		{ id: 'Source', color: 'red' }, { id: 'Target', drawsImage: true },
	], 'Target')
	const expected = await board.evaluate(snapshot => snapshot.pages[0].files.diagram!.dataURL)
	await page.addInitScript(() => {
		const add = IDBObjectStore.prototype.add
		IDBObjectStore.prototype.add = function (...args) {
			if (this.name === 'files' && !sessionStorage.allowBackfill) {
				sessionStorage.sawBackfill = '1'
				throw new DOMException('No space for a second copy', 'QuotaExceededError')
			}
			return add.apply(this, args)
		}
	})
	await openBoard(page)
	await expect(page.locator('canvas.interactive')).toBeVisible()
	expect(await page.evaluate(() => sessionStorage.sawBackfill)).toBe('1')
	expect(await storedImage(page, 'Source')).toBe(expected)
	expect(await storedImage(page, 'Target')).toBeNull()
	await page.evaluate(() => { sessionStorage.allowBackfill = '1' })
	await page.reload()
	await expect.poll(() => storedImage(page, 'Target')).toBe(expected)
})

test('migration keeps a historical image copy that an older tab can still reuse', async ({ page }) => {
	const snapshot = await seedImageBoard(page, [
		{ id: 'Source', drawsImage: true, color: 'red' }, { id: 'Target', color: 'red' },
	], 'Target')
	const expected = await snapshot.evaluate(async board => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const open = indexedDB.open('zoltraak')
			open.onsuccess = () => resolve(open.result)
			open.onerror = () => reject(open.error)
		})
		const tx = db.transaction('documents', 'readwrite')
		tx.objectStore('documents').put(board, 'zoltraak-canvas')
		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve()
			tx.onabort = () => reject(tx.error)
		})
		db.close()
		return board.pages[1].files.diagram!.dataURL
	})
	await openBoard(page)
	expect(await storedImage(page, 'Target')).toBe(expected)
})
