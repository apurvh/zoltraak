import { expect, test, type Page } from '@playwright/test'

async function draw(page: Page, key: string, x: number, y: number, width = 100, height = 100) {
	await page.keyboard.press(key)
	await page.mouse.move(x, y)
	await page.mouse.down()
	await page.mouse.move(x + width, y + height, { steps: 3 })
	await page.mouse.up()
}

test('T6: right-edge clicks create horizontal arrows from the click location', async ({ page }, testInfo) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())
	await draw(page, 'r', 250, 200)
	await draw(page, 'r', 550, 200)
	await draw(page, 'r', 850, 200)
	const ids = await page.evaluate(() => window.__zoltraakTestApi!.getShapes().map((shape) => shape.id))
	const dot = page.locator(`.right-edge-connector[data-element-id="${ids[0]}"]`)
	await expect(dot).toBeVisible()
	await expect.poll(() => dot.evaluate((element) => getComputedStyle(element, '::after').opacity)).toBe('0')
	const bounds = await dot.boundingBox()
	expect(bounds!.x + bounds!.width / 2).toBeCloseTo(350)
	expect(bounds!.y + bounds!.height / 2).toBeCloseTo(250)
	await page.mouse.move(350, 210)
	await expect.poll(() => dot.evaluate((element) => getComputedStyle(element, '::after').opacity)).toBe('1')
	await page.mouse.move(450, 400)
	await expect.poll(() => dot.evaluate((element) => getComputedStyle(element, '::after').opacity)).toBe('0')
	await dot.click({ position: { x: 6, y: 10 } })
	await expect.poll(() => page.evaluate(() => {
		const arrow = window.__zoltraakTestApi!.getShapes().find((shape) => shape.type === 'arrow')
		const points = arrow?.props.points as number[][] | undefined
		return { start: (arrow?.props.startBinding as any)?.elementId, end: (arrow?.props.endBinding as any)?.elementId,
			startsAtClick: !!points && Math.abs((arrow!.props.x as number) + points[0][0] - 350) < 1,
			endsAtLeftEdge: !!points && Math.abs((arrow!.props.x as number) + points[1][0] - 550) < 1,
			y: arrow?.props.y, horizontal: !!points && points.length === 2 && points.every((point) => point[1] === 0), elbowed: arrow?.props.elbowed }
	})).toEqual({ start: ids[0], end: ids[1], startsAtClick: true, endsAtLeftEdge: true, y: 210, horizontal: true, elbowed: false })
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(4)
	await page.screenshot({ path: testInfo.outputPath('connections.png') })

	await dot.click({ position: { x: 6, y: 10 } })
	await expect(page.getByText('These elements are already connected.')).toHaveCount(0)
	expect(await page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(4)

	await page.getByRole('button', { name: 'Undo', exact: true }).click()
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(3)
	await page.getByRole('button', { name: 'Redo', exact: true }).click()
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(4)

	// Move the target using the editor, so its native binding code must update the arrow.
	await page.mouse.move(600, 200)
	await page.mouse.down()
	await page.mouse.move(650, 200, { steps: 5 })
	await page.mouse.up()
	await expect.poll(() => page.evaluate(() => {
		const shapes = window.__zoltraakTestApi!.getShapes()
		const target = shapes.find((shape) => shape.type === 'rectangle' && shape.props.x === 600)
		const arrow = shapes.find((shape) => shape.type === 'arrow')!
		const points = arrow.props.points as number[][]
		const end = points.at(-1)!
		return {
			targetX: target?.props.x,
			startX: (arrow.props.x as number) + points[0][0],
			startY: (arrow.props.y as number) + points[0][1],
			endX: (arrow.props.x as number) + end[0],
			endY: (arrow.props.y as number) + end[1],
			pointCount: points.length,
		}
	})).toEqual({ targetX: 600, startX: expect.closeTo(351, 0), startY: expect.closeTo(210, 0),
		endX: expect.closeTo(599, 0), endY: expect.closeTo(210, 0), pointCount: 2 })

	await page.reload()
	await page.waitForFunction(() => window.__zoltraakTestApi?.getShapes().length === 4)
	await expect.poll(() => page.evaluate(() => {
		const arrow = window.__zoltraakTestApi!.getShapes().find((shape) => shape.type === 'arrow')!
		return (arrow.props.endBinding as any).elementId
	})).toBe(ids[1])
})

test('T6: the clickable right edge follows a rotated shape', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await draw(page, 'r', 250, 200)
	await draw(page, 'r', 550, 250)
	const id = await page.evaluate(() => {
		const shapes = window.__zoltraakTestApi!.getShapes()
		window.__zoltraakTestApi!.updateScene({ elements: shapes.map((shape, index) => index === 0
			? { ...shape.props, angle: Math.PI / 2, version: (shape.props.version as number) + 1 }
			: shape.props) })
		return shapes[0].id
	})
	const dot = page.locator(`.right-edge-connector[data-element-id="${id}"]`)
	await expect.poll(async () => {
		const box = await dot.boundingBox()
		return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null
	}).toEqual({ x: 300, y: 300 })
	await dot.click()
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().filter((shape) => shape.type === 'arrow').length)).toBe(1)
})

test('T6: horizontal arrows stop at the first left-edge hit and missed clicks stay silent', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await draw(page, 'r', 250, 200, 100, 160)
	await draw(page, 'r', 500, 300)
	await draw(page, 'r', 700, 240, 100, 120)
	await draw(page, 'r', 950, 220, 100, 140)
	const ids = await page.evaluate(() => window.__zoltraakTestApi!.getShapes().map((shape) => shape.id))
	const edge = page.locator(`.right-edge-connector[data-element-id="${ids[0]}"]`)
	await edge.click({ position: { x: 6, y: 60 } })
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().filter((shape) => shape.type === 'arrow').map((arrow) => {
		const points = arrow.props.points as number[][]
		return { x: arrow.props.x, y: arrow.props.y,
			endsAtLeftEdge: Math.abs((arrow.props.x as number) + points[1][0] - 700) < 1,
			horizontal: points.length === 2 && points.every((point) => point[1] === 0), target: (arrow.props.endBinding as any)?.elementId }
	}))).toEqual([{ x: 350, y: 260, endsAtLeftEdge: true, horizontal: true, target: ids[2] }])
	// A second click on the same source can make a connection at a different height.
	await edge.click({ position: { x: 6, y: 120 } })
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().filter((shape) => shape.type === 'arrow').map((arrow) => ({
		y: arrow.props.y, target: (arrow.props.endBinding as any)?.elementId,
	})))).toEqual([{ y: 260, target: ids[2] }, { y: 320, target: ids[1] }])
	await edge.click({ position: { x: 6, y: 10 } })
	await expect(page.getByText('No element to the right.')).toHaveCount(0)
	await expect(page.getByText('These elements are already connected.')).toHaveCount(0)
	expect(await page.evaluate(() => window.__zoltraakTestApi!.getShapes().filter((shape) => shape.type === 'arrow').length)).toBe(2)
})

test('T6: clickable edges support images, drawing modes, zoom, and scrolling', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await draw(page, 's', 250, 200, 160, 160)
	await draw(page, 'd', 650, 200, 160, 160)
	await expect(page.locator('.right-edge-connector')).toHaveCount(3)
	await page.keyboard.press('r')
	await expect(page.locator('.right-edge-connector')).toHaveCount(0)
	await page.keyboard.press('v')
	await expect(page.locator('.right-edge-connector')).toHaveCount(3)
	await page.evaluate(() => window.__zoltraakTestApi!.updateScene({ appState: { zoom: { value: 0.75 }, scrollX: 40, scrollY: 20 } }))
	const expected = await page.evaluate(() => {
		const shape = window.__zoltraakTestApi!.getShapes()[0]
		const state = window.__zoltraakTestApi!.getAppState()
		return { id: shape.id, x: ((shape.props.x as number) + (shape.props.width as number) + state.scrollX) * state.zoom.value + state.offsetLeft,
			y: ((shape.props.y as number) + (shape.props.height as number) / 2 + state.scrollY) * state.zoom.value + state.offsetTop }
	})
	const dot = page.locator(`.right-edge-connector[data-element-id="${expected.id}"]`)
	await expect.poll(async () => {
		const box = await dot.boundingBox()
		return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null
	}).toEqual({ x: expected.x, y: expected.y })
	await dot.click({ position: { x: 6, y: 20 } })
	await expect.poll(() => page.evaluate(() => {
		const arrow = window.__zoltraakTestApi!.getShapes().find((shape) => shape.type === 'arrow')
		const points = arrow?.props.points as number[][] | undefined
		return arrow && points ? { y: arrow.props.y,
			endsAtLeftEdge: Math.abs((arrow.props.x as number) + points[1][0] - 650) < 1,
			horizontal: points.length === 2 && points.every((point) => point[1] === 0) } : null
	})).toEqual({ y: expect.closeTo(200 + 20 / 0.75, 1), endsAtLeftEdge: true, horizontal: true })
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().filter((shape) => shape.type === 'arrow').length)).toBe(1)
	await page.locator('.right-edge-connector').last().click()
	await expect(page.getByText('No element to the right.')).toHaveCount(0)
	expect(await page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(4)
})
