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

test('loading an older drawing removes a copied image from an empty page', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	const firstPageId = await page.evaluate(() => window.__zoltraakTestApi!.getCurrentPageId())
	const imageId = 'default-image-stick-user'
	await page.keyboard.press('s')
	await page.mouse.click(420, 250)
	await expect.poll(() => storedFileKeys(page)).toEqual([[firstPageId, imageId]])
	await page.keyboard.press('Meta+k')
	await page.getByRole('option', { name: /Create new page/ }).click()
	const blankPageId = await page.evaluate(() => window.__zoltraakTestApi!.getCurrentPageId())

	await page.evaluate(({ firstPageId, imageId, blankPageId }) => new Promise<void>((resolve, reject) => {
		const open = indexedDB.open('zoltraak')
		open.onerror = () => reject(open.error)
		open.onsuccess = () => {
			const db = open.result
			const tx = db.transaction('files', 'readwrite')
			const files = tx.objectStore('files')
			const get = files.get([firstPageId, imageId])
			get.onsuccess = () => files.put({ ...get.result, pageId: blankPageId }, [blankPageId, imageId])
			tx.oncomplete = () => { db.close(); resolve() }
			tx.onabort = () => { db.close(); reject(tx.error) }
		}
	}), { firstPageId, imageId, blankPageId })
	expect(await storedFileKeys(page)).toHaveLength(2)
	await page.reload()
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await expect.poll(() => storedFileKeys(page)).toEqual([[firstPageId, imageId]])
})
