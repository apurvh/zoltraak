import { expect, test } from '@playwright/test'

test('T1: r and a draw shapes freely, selected shapes delete with macOS Delete key', async ({
	page,
}) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi)
	await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())

	await page.keyboard.press('r')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi?.getCurrentToolId())).toBe('geo')
	await page.mouse.move(220, 180)
	await page.mouse.down()
	await page.mouse.move(420, 320)
	await page.mouse.up()

	await expect
		.poll(() =>
			page.evaluate(() =>
				window.__zoltraakTestApi
					?.getShapes()
					.some((shape) => shape.type === 'geo' && shape.props.geo === 'rectangle')
			)
		)
		.toBe(true)

	await page.keyboard.press('a')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi?.getCurrentToolId())).toBe('arrow')
	await page.mouse.move(500, 220)
	await page.mouse.down()
	await page.mouse.move(680, 360)
	await page.mouse.up()

	await expect
		.poll(() =>
			page.evaluate(() =>
				window.__zoltraakTestApi?.getShapes().some((shape) => shape.type === 'arrow')
			)
		)
		.toBe(true)

	const selectedShapeIds = await page.evaluate(() => window.__zoltraakTestApi?.getSelectedShapeIds() ?? [])
	expect(selectedShapeIds.length).toBeGreaterThan(0)

	await page.keyboard.press('Backspace')

	await expect
		.poll(() =>
			page.evaluate(() => ({
				shapeCount: window.__zoltraakTestApi?.getShapes().length ?? -1,
				selectedCount: window.__zoltraakTestApi?.getSelectedShapeIds().length ?? -1,
			}))
		)
		.toEqual({ shapeCount: 1, selectedCount: 0 })
})
