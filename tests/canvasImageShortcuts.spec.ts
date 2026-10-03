import { expect, test } from '@playwright/test'

for (const { key, imageId, start, end } of [
	{ key: 's', imageId: 'stick-user', start: { x: 220, y: 180 }, end: { x: 420, y: 380 } },
	{ key: 'd', imageId: 'database', start: { x: 520, y: 420 }, end: { x: 320, y: 220 } },
]) {
	test(`${key} draws the bundled ${imageId} with native image placement`, async ({ page }) => {
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
			width: expect.closeTo(200, 2),
			height: expect.closeTo(200, 2),
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

test('image shortcuts can be replaced or cancelled and do not intercept typing', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await page.mouse.click(100, 100)
	await page.keyboard.press('s')
	await page.keyboard.press('d')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().map((shape) => shape.props.fileId))).toEqual(['default-image-database'])
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

	await page.keyboard.press('Meta+k')
	const search = page.getByPlaceholder('Search pages...')
	await search.pressSequentially('sd')
	await expect(search).toHaveValue('sd')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(0)
})

test('changing pages cancels an image that has not been placed', async ({ page }) => {
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
