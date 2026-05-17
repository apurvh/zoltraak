import { expect, test } from '@playwright/test'

test('T5: Auto Shape from Selection Drag', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi)
	await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())

	// Ensure we are in selection mode
	await page.keyboard.press('v')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi?.getCurrentToolId())).toBe('selection')

	// 1. Small drag should do nothing
	await page.mouse.move(100, 100)
	await page.mouse.down()
	await page.mouse.move(110, 110)
	await page.mouse.up()

	await expect
		.poll(() => page.evaluate(() => window.__zoltraakTestApi?.getShapes().length))
		.toBe(0)

	// 2. Wide, boxy drag creates a Rectangle
	await page.mouse.move(200, 200)
	await page.mouse.down()
	await page.mouse.move(400, 300) // 200x100
	await page.mouse.up()

	await expect
		.poll(() =>
			page.evaluate(() => {
				const shapes = window.__zoltraakTestApi?.getShapes() || []
				const rects = shapes.filter((s) => s.type === 'rectangle')
				return { count: shapes.length, rectsCount: rects.length }
			})
		)
		.toEqual({ count: 1, rectsCount: 1 })

	// 3. Horizontal drag creates a horizontal Arrow
	await page.mouse.move(500, 200)
	await page.mouse.down()
	await page.mouse.move(900, 210) // 400x10
	await page.mouse.up()

	await expect
		.poll(() =>
			page.evaluate(() => {
				const shapes = window.__zoltraakTestApi?.getShapes() || []
				const arrows = shapes.filter((s) => s.type === 'arrow')
				return { count: shapes.length, arrowsCount: arrows.length }
			})
		)
		.toEqual({ count: 2, arrowsCount: 1 })

	// 4. Vertical drag creates a vertical Arrow
	await page.mouse.move(200, 400)
	await page.mouse.down()
	await page.mouse.move(210, 800) // 10x400
	await page.mouse.up()

	await expect
		.poll(() =>
			page.evaluate(() => {
				const shapes = window.__zoltraakTestApi?.getShapes() || []
				const arrows = shapes.filter((s) => s.type === 'arrow')
				return { count: shapes.length, arrowsCount: arrows.length }
			})
		)
		.toEqual({ count: 3, arrowsCount: 2 })

	// 5. Dragging over existing element just selects it, no new shape
	// Let's drag over the first rectangle (approx at 200,200 to 400,300)
	// Make sure we clear selection first
	await page.mouse.click(10, 10)
	
	await page.mouse.move(190, 190)
	await page.mouse.down()
	await page.mouse.move(410, 310)
	await page.mouse.up()

	// Wait a moment for selection to be updated
	await page.waitForTimeout(100)

	await expect
		.poll(() =>
			page.evaluate(() => {
				const shapes = window.__zoltraakTestApi?.getShapes() || []
				const selected = window.__zoltraakTestApi?.getSelectedShapeIds() || []
				return { count: shapes.length, selectedCount: selected.length }
			})
		)
		.toEqual({ count: 3, selectedCount: 1 })
})
