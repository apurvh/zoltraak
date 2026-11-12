import { expect, test, type Page } from '@playwright/test'

async function seedLegacyBoard(page: Page, partial = false) {
	// Use a real Excalidraw image so the fixture can also exercise editing and rendering.
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await page.keyboard.press('s')
	await page.mouse.click(320, 220)
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId() === 'selection' &&
		window.__zoltraakTestApi.getShapes().some(shape => shape.type === 'image' && Number(shape.props.width) > 0))
	const image = await page.evaluate(() => window.__zoltraakTestApi!.getShapes()[0].props)
	await page.route('**/legacy-fixture', route => route.fulfill({ contentType: 'text/html', body: '<title>Old board</title>' }))
	await page.goto('/legacy-fixture')
	return page.evaluate(async ({ image, partial }) => {
		const request = <T>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
			req.onsuccess = () => resolve(req.result)
			req.onerror = () => reject(req.error)
		})
		await request(indexedDB.deleteDatabase('zoltraak'))
		function makeFile(id: string, color: string) {
			const canvas = document.createElement('canvas')
			canvas.width = canvas.height = 2
			const context = canvas.getContext('2d')!
			context.fillStyle = color
			context.fillRect(0, 0, 2, 2)
			return { id, dataURL: canvas.toDataURL(), mimeType: 'image/png', created: 1 }
		}
		const originalImage = makeFile('diagram', 'red')
		const newerImage = makeFile('diagram', 'blue')
		const attachment = makeFile('attachment', 'green')
		const extraImage = makeFile('extra-image', 'black')
		// The first release had no updatedAt on the document or any page.
		const design = {
			id: 'design', name: 'Original design', appState: {},
			elements: [{ ...image, id: 'old-shape', fileId: 'diagram' }],
			files: { diagram: originalImage, attachment },
		}
		const notes = { id: 'notes', name: 'Notes', appState: {}, elements: [], files: {} }
		const open = indexedDB.open('zoltraak', partial ? 2 : 1)
		open.onupgradeneeded = () => {
			const db = open.result
			db.createObjectStore('documents').put({ schemaVersion: 1, currentPageId: 'design', pages: [design, notes] }, 'zoltraak-canvas')
			if (!partial) return
			const pages = db.createObjectStore('pages')
			const files = db.createObjectStore('files')
			files.createIndex('byPage', 'pageId')
			pages.put({ id: 'design', name: 'Edited design', updatedAt: 200, appState: {},
				elements: [{ ...image, id: 'edited-shape', fileId: 'diagram' }] }, 'design')
			pages.put({ id: 'extra', name: 'Later page', updatedAt: 300, appState: {},
				elements: [{ ...image, id: 'extra-shape', fileId: 'extra-image' }] }, 'extra')
			files.put({ pageId: 'design', file: newerImage }, ['design', 'diagram'])
			files.put({ pageId: 'extra', file: extraImage }, ['extra', 'extra-image'])
		}
		const db = await request(open)
		db.close()
		return { originalImage, newerImage, attachment, extraImage }
	}, { image, partial })
}

async function readStorage(page: Page) {
	return page.evaluate(async () => {
		const read = <T>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
			req.onsuccess = () => resolve(req.result)
			req.onerror = () => reject(req.error)
		})
		const db = await read(indexedDB.open('zoltraak'))
		try {
			const tx = db.transaction(Array.from(db.objectStoreNames))
			const [metadata, pages, files] = await Promise.all([
				read(tx.objectStore('documents').get('zoltraak-canvas')),
				db.objectStoreNames.contains('pages') ? read(tx.objectStore('pages').getAll()) : [],
				db.objectStoreNames.contains('files') ? read(tx.objectStore('files').getAll()) : [],
			])
			return { metadata, pages, files }
		} finally {
			db.close()
		}
	})
}

test('a timestamp-free v1 drawing migrates and keeps new edits after reload', async ({ page }) => {
	const { originalImage, attachment } = await seedLegacyBoard(page)
	await page.goto('/')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi?.getShapes().map(shape => shape.id))).toEqual(['old-shape'])
	await page.keyboard.press('r')
	await page.mouse.move(520, 250)
	await page.mouse.down()
	await page.mouse.move(680, 360)
	await page.mouse.up()
	await expect.poll(async () => (await readStorage(page)).pages.find(row => row.id === 'design')?.elements.length).toBe(2)
	await page.reload()
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi?.getShapes().map(shape => shape.type))).toEqual(['image', 'rectangle'])
	const { metadata, files } = await readStorage(page)
	expect(metadata.pageIds).toEqual(['design', 'notes'])
	expect(metadata.pages).toBeUndefined()
	expect(files).toEqual(expect.arrayContaining([{ pageId: 'design', file: originalImage }, { pageId: 'design', file: attachment }]))
})

test('a partially migrated board keeps newer split pages, images and legacy attachments', async ({ page }) => {
	const { newerImage, attachment, extraImage } = await seedLegacyBoard(page, true)
	await page.goto('/')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi?.getShapes().map(shape => shape.id))).toEqual(['edited-shape'])
	expect(await page.evaluate(() => window.__zoltraakTestApi!.getPages().map(entry => entry.name).sort()))
		.toEqual(['Edited design', 'Later page', 'Notes'])
	await page.keyboard.press('Meta+k')
	await page.getByRole('textbox', { name: 'Search pages' }).fill('Later page')
	await page.keyboard.press('Enter')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi?.getShapes().map(shape => shape.id))).toEqual(['extra-shape'])
	await expect.poll(async () => (await readStorage(page)).metadata.currentPageId).toBe('extra')
	await page.reload()
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi?.getShapes().map(shape => shape.id))).toEqual(['extra-shape'])
	const { metadata, files } = await readStorage(page)
	expect(metadata.pageIds.slice().sort()).toEqual(['design', 'extra', 'notes'])
	expect(files).toEqual(expect.arrayContaining([
		{ pageId: 'design', file: newerImage }, { pageId: 'design', file: attachment }, { pageId: 'extra', file: extraImage },
	]))
})

test('a failed migration leaves the v1 board intact for retry', async ({ page }) => {
	await seedLegacyBoard(page)
	const before = (await readStorage(page)).metadata
	await page.addInitScript(() => {
		const put = IDBObjectStore.prototype.put
		IDBObjectStore.prototype.put = function (...args) {
			if (this.name === 'files' && !sessionStorage.allowMigration) {
				throw new DOMException('Storage full', 'QuotaExceededError')
			}
			return put.apply(this, args)
		}
	})
	await page.goto('/')
	await expect(page.getByRole('alert')).toContainText('Couldn’t open your saved drawings')
	expect(await readStorage(page)).toEqual({ metadata: before, pages: [], files: [] })
	await page.evaluate(() => { sessionStorage.allowMigration = '1' })
	await page.getByRole('button', { name: 'Try again' }).click()
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi?.getShapes().map(shape => shape.id))).toEqual(['old-shape'])
	expect((await readStorage(page)).metadata.pageIds).toEqual(['design', 'notes'])
})

test('concurrent loads migrate the embedded board once and return the same recovered pages', async ({ page }) => {
	await seedLegacyBoard(page, true)
	const { first, second, conversions } = await page.evaluate(async () => {
		const modulePath = '/src/lib/document.ts'
		const { loadDocument } = await import(modulePath) as typeof import('../src/lib/document')
		const put = IDBObjectStore.prototype.put
		let conversions = 0
		IDBObjectStore.prototype.put = function (...args) {
			if (this.name === 'documents') conversions++
			return put.apply(this, args)
		}
		try {
			const [first, second] = await Promise.all([loadDocument(), loadDocument()])
			return { first, second, conversions }
		} finally {
			IDBObjectStore.prototype.put = put
		}
	})
	expect(conversions).toBe(1)
	expect(second).toEqual(first)
	expect(first.pages.map(entry => entry.id)).toEqual(['design', 'notes', 'extra'])
	expect(first.currentPageId).toBe('design')
	expect(first.updatedAt).toBeGreaterThanOrEqual(300)
})
