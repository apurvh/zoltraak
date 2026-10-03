import { expect, test } from '@playwright/test'

test('normalization does not reuse a shape that the editor has since changed', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await page.keyboard.press('r')
	await page.mouse.move(220, 180)
	await page.mouse.down()
	await page.mouse.move(420, 320)
	await page.mouse.up()
	const result = await page.evaluate(async () => {
		const modulePath = '/src/lib/excalidrawScene.ts'
		const { createSceneNormalizer } = await import(modulePath)
		const normalize = createSceneNormalizer()
		const source = { ...window.__zoltraakTestApi!.getShapes()[0].props, x: 100, roughness: 2 }
		const normalized = normalize([source]).elements[0]
		// The editor mutates the normalized object during a later drag.
		normalized.x = 900
		normalized.version += 1
		return normalize([source]).elements[0].x
	})
	expect(result).toBe(100)
})

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

test('T5: selecting a rectangle stays selected with many pages', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi)
	await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())

	await page.keyboard.press('r')
	await page.mouse.move(220, 180)
	await page.mouse.down()
	await page.mouse.move(420, 320)
	await page.mouse.up()

	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(1)

	for (let i = 0; i < 8; i += 1) {
		await page.keyboard.press('Meta+K')
		await page.getByRole('option', { name: /Create new page/ }).click()
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getPages().length)).toBe(i + 2)
	}

	await page.keyboard.press('Meta+K')
	await page.getByPlaceholder('Search pages...').fill('Page 1')
	await page.keyboard.press('Enter')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(1)

	await page.keyboard.press('v')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getCurrentToolId())).toBe('selection')
	const clickPoint = await page.evaluate(() => {
		const rectangle = window.__zoltraakTestApi!.getShapes()[0]
		const appState = window.__zoltraakTestApi!.getAppState()
		const zoom = appState.zoom?.value ?? 1
		const props = rectangle.props as any

		return {
			x: (props.x + props.width / 2) * zoom + appState.scrollX,
			y: props.y * zoom + appState.scrollY,
		}
	})
	await page.mouse.click(clickPoint.x, clickPoint.y)
	await page.waitForTimeout(250)

	await expect
		.poll(() =>
			page.evaluate(() => ({
				selectedCount: window.__zoltraakTestApi!.getSelectedShapeIds().length,
				shapeCount: window.__zoltraakTestApi!.getShapes().length,
				tool: window.__zoltraakTestApi!.getCurrentToolId(),
			}))
		)
		.toEqual({ selectedCount: 1, shapeCount: 1, tool: 'selection' })
})
