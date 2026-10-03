import { expect, test } from '@playwright/test'

for (const { key, name } of [
	{ key: 'c', name: 'Cache' },
	{ key: 'd', name: 'Database' },
	{ key: 'q', name: 'Queue' },
]) {
	test(`${name}: default name can be edited and moves with the image`, async ({ page }) => {
		await page.goto('/')
		await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
		await page.mouse.click(100, 100)
		await page.keyboard.press(key)
		await page.mouse.move(300, 200)
		await page.mouse.down()
		await page.mouse.move(500, key === 'q' ? 296 : 400, { steps: 5 })
		await page.mouse.up()
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(2)
		const shapes = await page.evaluate(() => window.__zoltraakTestApi!.getShapes())
		const image = shapes.find((shape) => shape.type === 'image')!
		const label = shapes.find((shape) => shape.type === 'text')!
		expect(label.props.text).toBe(name)
		expect(label.props.groupIds).toEqual(image.props.groupIds)
		expect(label.props.y).toBe(key === 'q' ? 304 : 386)
		expect((label.props.x as number) + (label.props.width as number) / 2)
			.toBeCloseTo((image.props.x as number) + (image.props.width as number) / 2)
		await page.mouse.dblclick((label.props.x as number) + (label.props.width as number) / 2,
			(label.props.y as number) + (label.props.height as number) / 2)
		const editor = page.locator('textarea.excalidraw-wysiwyg')
		await expect(editor).toBeVisible()
		await editor.fill(`My ${name}`)
		await page.keyboard.press('Escape')
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().find((shape) => shape.type === 'text')?.props.text)).toBe(`My ${name}`)
		await page.getByRole('button', { name: 'Undo', exact: true }).click()
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().find((shape) => shape.type === 'text')?.props.text)).toBe(name)
		await page.getByRole('button', { name: 'Redo', exact: true }).click()
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().find((shape) => shape.type === 'text')?.props.text)).toBe(`My ${name}`)
		await page.mouse.click(800, 500)
		await page.mouse.move(400, 220)
		await page.mouse.down()
		await page.mouse.move(450, 260, { steps: 5 })
		await page.mouse.up()
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().map((shape) => ({
			id: shape.id, x: shape.props.x, y: shape.props.y,
		})))).toEqual([
			{ id: image.id, x: 350, y: 240 },
			{ id: label.id, x: expect.any(Number), y: (label.props.y as number) + 40 },
		])
		// Wait for the normal autosave before reloading the page.
		await expect.poll(() => page.evaluate(async () => {
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const request = indexedDB.open('zoltraak')
				request.onsuccess = () => resolve(request.result)
				request.onerror = () => reject(request.error)
			})
			const stored = await new Promise<any>((resolve, reject) => {
				const request = db.transaction('pages').objectStore('pages').get(window.__zoltraakTestApi!.getCurrentPageId())
				request.onsuccess = () => resolve(request.result)
				request.onerror = () => reject(request.error)
			})
			db.close()
			return stored?.elements.find((element: any) => element.type === 'text' && !element.isDeleted)?.text
		})).toBe(`My ${name}`)
		await page.reload()
		await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().find((shape) => shape.type === 'text')?.props.text)).toBe(`My ${name}`)
	})
}

test('a click places a named cache at its natural size and undo removes both', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await page.keyboard.press('c')
	await page.mouse.click(400, 300)
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().map((shape) => ({
		type: shape.type, x: shape.props.x, y: shape.props.y, width: shape.props.width, text: shape.props.text,
	})))).toEqual([
		{ type: 'image', x: 320, y: 220, width: 160, text: undefined },
		{ type: 'text', x: expect.any(Number), y: expect.closeTo(370.4, 2), width: expect.any(Number), text: 'Cache' },
	])
	await page.getByRole('button', { name: 'Undo', exact: true }).click()
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(0)
	await page.getByRole('button', { name: 'Redo', exact: true }).click()
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(2)
})

test('undoing a second named diagram keeps the first diagram and its name', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	for (const [key, x] of [['c', 300], ['d', 650]] as const) {
		await page.keyboard.press(key)
		await page.mouse.move(x, 200)
		await page.mouse.down()
		await page.mouse.move(x + 160, 360, { steps: 5 })
		await page.mouse.up()
	}
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(4)
	await page.getByRole('button', { name: 'Undo', exact: true }).click()
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().map((shape) => shape.type === 'image'
		? shape.props.fileId : shape.props.text))).toEqual(['default-image-cache-v2', 'Cache'])
	await page.getByRole('button', { name: 'Redo', exact: true }).click()
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(4)
	await page.mouse.click(730, 220)
	await page.keyboard.press('Backspace')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().map((shape) => shape.type === 'image'
		? shape.props.fileId : shape.props.text))).toEqual(['default-image-cache-v2', 'Cache'])
})
