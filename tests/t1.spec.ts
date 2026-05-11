import { expect, test } from '@playwright/test'

test('T1: r and a draw shapes freely, selected shapes delete with macOS Delete key', async ({
	page,
}) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi)
	await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())

	await page.keyboard.press('r')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi?.getCurrentToolId())).toBe('rectangle')
	await page.mouse.move(220, 180)
	await page.mouse.down()
	await page.mouse.move(420, 320)
	await page.mouse.up()

	await expect
		.poll(() =>
			page.evaluate(() =>
				window.__zoltraakTestApi
					?.getShapes()
					.some((shape) => shape.type === 'rectangle')
			)
		)
		.toBe(true)

	await expect
		.poll(() =>
			page.evaluate(() => {
				const rectangle = window.__zoltraakTestApi
					?.getShapes()
					.find((shape) => shape.type === 'rectangle')

				return {
					roughness: rectangle?.props.roughness,
					roundness: rectangle?.props.roundness ?? null,
				}
			})
		)
		.toEqual({ roughness: 0.5, roundness: { type: 3, value: 6.4 } })

	await page.keyboard.press('r')
	await page.mouse.move(520, 160)
	await page.mouse.down()
	await page.mouse.move(900, 520)
	await page.mouse.up()

	await expect
		.poll(() =>
			page.evaluate(() =>
				window.__zoltraakTestApi
					?.getShapes()
					.filter((shape) => shape.type === 'rectangle')
					.map((shape) => ({
						roughness: shape.props.roughness,
						roundness: shape.props.roundness ?? null,
					}))
			)
		)
		.toEqual([
			{ roughness: 0.5, roundness: { type: 3, value: 6.4 } },
			{ roughness: 0.5, roundness: { type: 3, value: 6.4 } },
		])

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

	await expect
		.poll(() =>
			page.evaluate(() => {
				const arrow = window.__zoltraakTestApi
					?.getShapes()
					.find((shape) => shape.type === 'arrow')
				const points = arrow?.props.points as Array<[number, number]> | undefined
				const startPoint = points?.at(0)
				const endPoint = points?.at(-1)
				const arrowLength =
					startPoint && endPoint
						? Math.hypot(endPoint[0] - startPoint[0], endPoint[1] - startPoint[1])
						: null

				return {
					endArrowhead: arrow?.props.endArrowhead,
					hasVisibleLength: arrowLength !== null && arrowLength > 100,
					roughness: arrow?.props.roughness,
				}
			})
		)
		.toEqual({ endArrowhead: 'triangle_outline', hasVisibleLength: true, roughness: 0.5 })

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
		.toEqual({ shapeCount: 2, selectedCount: 0 })
})
