import { expect, test } from '@playwright/test'

for (const initialZoom of [0.5, 1, 2]) {
	test(`T7: z resets ${initialZoom * 100}% zoom like the Reset Zoom button`, async ({ page }) => {
		await page.goto('/')
		await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
		await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())
		await page.mouse.click(100, 100)
		await page.keyboard.press('r')
		await page.mouse.move(220, 180)
		await page.mouse.down()
		await page.mouse.move(420, 320)
		await page.mouse.up()
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getSelectedShapeIds().length)).toBe(1)

		const seedZoom = () => page.evaluate((value) => {
			window.__zoltraakTestApi!.updateScene({ appState: {
				zoom: { value }, scrollX: 125, scrollY: -75,
			} })
		}, initialZoom)
		const readState = () => page.evaluate(() => {
			const api = window.__zoltraakTestApi!
			const state = api.getAppState()
			return {
				zoom: state.zoom.value,
				scrollX: state.scrollX,
				scrollY: state.scrollY,
				tool: api.getCurrentToolId(),
				selected: api.getSelectedShapeIds(),
			}
		})
		await seedZoom()
		await expect.poll(async () => (await readState()).zoom).toBe(initialZoom)
		const before = await readState()
		await page.getByRole('button', { name: 'Reset zoom', exact: true }).click()
		await expect.poll(async () => (await readState()).zoom).toBe(1)
		const buttonResult = await readState()
		expect(buttonResult.tool).toBe(before.tool)
		expect(buttonResult.selected).toEqual(before.selected)

		await seedZoom()
		await expect.poll(async () => (await readState()).zoom).toBe(initialZoom)
		await page.keyboard.press('z')
		await expect.poll(readState).toEqual(buttonResult)
	})
}

test('T7: both Command+K and Ctrl+K open the page switcher', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await page.mouse.click(100, 100)
	for (const shortcut of ['Meta+k', 'Control+k']) {
		await page.keyboard.press(shortcut)
		await expect(page.getByPlaceholder('Search pages...')).toBeFocused()
		await page.keyboard.press('Escape')
		await expect(page.getByPlaceholder('Search pages...')).not.toBeVisible()
	}
})

for (const { key, imageId, start, end } of [
	{ key: 's', imageId: 'stick-user', start: { x: 220, y: 180 }, end: { x: 420, y: 380 } },
	{ key: 'd', imageId: 'database', start: { x: 520, y: 420 }, end: { x: 320, y: 220 } },
	{ key: 'q', imageId: 'queue', start: { x: 220, y: 180 }, end: { x: 420, y: 276 } },
	{ key: 'c', imageId: 'cache', start: { x: 220, y: 180 }, end: { x: 420, y: 380 } },
]) {
	test(`T7: ${key} draws the bundled ${imageId} with native image placement`, async ({ page }) => {
		await page.goto('/')
		await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
		await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())
		await page.mouse.click(100, 100)
		await page.keyboard.press(key)
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getCurrentToolId())).toBe('image')
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getAppState().pendingImageElementId)).toBeTruthy()

		await page.mouse.move(start.x, start.y)
		await page.mouse.down()
		await page.mouse.move(end.x, end.y, { steps: 5 })
		// The image is visible and sized during the drag.
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes()[0]?.props.width)).toBeGreaterThan(100)
		await page.mouse.up()

		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().map((shape) => ({
			type: shape.type,
			fileId: shape.props.fileId,
			customData: shape.props.customData,
			x: shape.props.x,
			y: shape.props.y,
			width: shape.props.width,
			height: shape.props.height,
		})))).toEqual([{
			type: 'image',
			fileId: `default-image-${imageId}`,
			customData: { defaultImageId: imageId },
			x: expect.closeTo(Math.min(start.x, end.x), 2),
			y: expect.closeTo(Math.min(start.y, end.y), 2),
			width: expect.closeTo(Math.abs(end.x - start.x), 2),
			height: expect.closeTo(Math.abs(end.y - start.y), 2),
		}])
		await expect.poll(() => page.evaluate(() => ({
			tool: window.__zoltraakTestApi!.getCurrentToolId(),
			selectedCount: window.__zoltraakTestApi!.getSelectedShapeIds().length,
		}))).toEqual({ tool: 'selection', selectedCount: 1 })

		await page.getByRole('button', { name: 'Undo', exact: true }).click()
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(0)
		await page.getByRole('button', { name: 'Redo', exact: true }).click()
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(1)
		await page.reload()
		await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes()[0]?.props.fileId)).toBe(`default-image-${imageId}`)
	})
}

test('T7: image shortcuts can be replaced or cancelled and do not intercept typing', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await page.mouse.click(100, 100)
	await page.keyboard.press('s')
	await page.keyboard.press('d')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().map((shape) => shape.props.fileId))).toEqual(['default-image-database'])
	await page.keyboard.press('Escape')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(0)
	await page.keyboard.press('q')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().map((shape) => shape.props.fileId))).toEqual(['default-image-queue'])
	await page.keyboard.press('c')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().map((shape) => shape.props.fileId))).toEqual(['default-image-cache'])
	await page.keyboard.press('Escape')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(0)

	await page.keyboard.press('s')
	await page.keyboard.press('r')
	await expect.poll(() => page.evaluate(() => ({
		tool: window.__zoltraakTestApi!.getCurrentToolId(),
		count: window.__zoltraakTestApi!.getShapes().length,
	}))).toEqual({ tool: 'rectangle', count: 0 })

	await page.keyboard.press('d')
	await page.reload()
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(0)
	await page.evaluate(() => window.__zoltraakTestApi!.updateScene({ appState: { zoom: { value: 0.5 } } }))

	await page.keyboard.press('Meta+k')
	const search = page.getByPlaceholder('Search pages...')
	await search.pressSequentially('rasdqcz')
	await expect(search).toHaveValue('rasdqcz')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(0)
	expect(await page.evaluate(() => window.__zoltraakTestApi!.getAppState().zoom.value)).toBe(0.5)
})

test('T7: changing pages cancels an image that has not been placed', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await page.mouse.click(100, 100)
	await page.keyboard.press('d')
	await page.keyboard.press('Meta+k')
	await page.getByRole('option', { name: /Create new page/ }).click()
	await expect.poll(() => page.evaluate(() => ({
		tool: window.__zoltraakTestApi!.getCurrentToolId(),
		count: window.__zoltraakTestApi!.getShapes().length,
	}))).toEqual({ tool: 'selection', count: 0 })
	await page.keyboard.press('Meta+k')
	await page.getByPlaceholder('Search pages...').fill('Page 1')
	await page.keyboard.press('Enter')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(0)
})
