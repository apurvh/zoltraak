import { expect, test } from '@playwright/test'

for (const fontSize of [16, 20, 28, 36]) {
	for (const zoom of [0.5, 1, 2]) {
		test(`bound text decoration stays wrapped at size ${fontSize}, zoom ${zoom}`, async ({ page }, testInfo) => {
			await page.goto('/')
			await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
			await page.mouse.click(100, 100)
			await page.evaluate(({ fontSize, zoom }) => window.__zoltraakTestApi!.updateScene({
				appState: { currentItemFontSize: fontSize, zoom: { value: zoom }, scrollX: 0, scrollY: 0 },
			}), { fontSize, zoom })
			await page.keyboard.press('r')
			await page.mouse.move(400, 220)
			await page.mouse.down()
			await page.mouse.move(400 + 140 * zoom, 220 + 80 * zoom)
			await page.mouse.up()
			for (const source of ['agent database gateway', 'database gateway', 'agent database gateway\nsecond line']) {
				const point = await page.evaluate(() => {
					const shape = window.__zoltraakTestApi!.getShapes().find((s) => s.type === 'rectangle')!.props as any
					const state = window.__zoltraakTestApi!.getAppState()
					return { x: (shape.x + shape.width / 2 + state.scrollX) * state.zoom.value + state.offsetLeft,
						y: (shape.y + shape.height / 2 + state.scrollY) * state.zoom.value + state.offsetTop }
				})
				await page.mouse.dblclick(point.x, point.y)
				const editor = page.locator('textarea.excalidraw-wysiwyg')
				await expect(editor).toBeVisible()
				await editor.fill(source)
				await page.keyboard.press('Escape')
				await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().find((s) => s.type === 'text')?.props.originalText))
					.toBe(source.includes('agent') ? `✨ ${source}` : source)
				const geometry = await page.evaluate(() => {
					const shapes = window.__zoltraakTestApi!.getShapes()
					const box = shapes.find((s) => s.type === 'rectangle')!.props as any
					const text = shapes.find((s) => s.type === 'text')!.props as any
					const ctx = document.createElement('canvas').getContext('2d')!
					ctx.font = `${text.fontSize}px Excalifont, Xiaolai, Segoe UI Emoji`
					return { width: text.width, measuredWidth: Math.max(...text.text.split('\n').map((line: string) => ctx.measureText(line).width)),
						height: text.height, measuredHeight: text.text.split('\n').length * text.fontSize * text.lineHeight,
						inside: text.x >= box.x && text.y >= box.y && text.x + text.width <= box.x + box.width && text.y + text.height <= box.y + box.height,
						containerId: text.containerId, boxId: box.id }
				})
				expect(geometry.width).toBeCloseTo(geometry.measuredWidth, 1)
				expect(geometry.height).toBe(geometry.measuredHeight)
				expect(geometry.inside).toBe(true)
				expect(geometry.containerId).toBe(geometry.boxId)
			}
			if (fontSize === 20 && zoom === 1) await page.screenshot({ path: testInfo.outputPath('wrapped-agent-text.png') })
		})
	}
}

test('free multiline decoration uses the widest line and survives repeated editing', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await page.mouse.click(100, 100)
	await page.keyboard.press('t')
	await page.mouse.click(400, 220)
	for (const source of ['agent\nsecond long line', 'plain\nsecond long line', 'agent\nsecond long line']) {
		const editor = page.locator('textarea.excalidraw-wysiwyg')
		await editor.fill(source)
		await page.keyboard.press('Escape')
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes()[0]?.props.originalText))
			.toBe(source.includes('agent') ? `✨ ${source}` : source)
		const dimensions = await page.evaluate(() => {
			const text = window.__zoltraakTestApi!.getShapes()[0].props as any
			const ctx = document.createElement('canvas').getContext('2d')!
			ctx.font = `${text.fontSize}px Excalifont, Xiaolai, Segoe UI Emoji`
			return { width: text.width, measured: Math.max(...text.text.split('\n').map((line: string) => ctx.measureText(line).width)) }
		})
		expect(dimensions.width).toBeCloseTo(dimensions.measured, 1)
		await page.mouse.dblclick(430, 230)
	}
	await page.keyboard.press('Escape')
})

test('existing clipped text is repaired without changing identities or bindings', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await page.mouse.click(100, 100)
	await page.keyboard.press('r')
	await page.mouse.move(400, 220)
	await page.mouse.down()
	await page.mouse.move(520, 280)
	await page.mouse.up()
	await page.mouse.dblclick(460, 250)
	await page.locator('textarea.excalidraw-wysiwyg').fill('agent database gateway')
	await page.keyboard.press('Escape')
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().find((s) => s.type === 'text')?.props.originalText)).toBe('✨ agent database gateway')
	const result = await page.evaluate(async () => {
		const modulePath = '/src/lib/excalidrawScene.ts'
		const { createSceneNormalizer } = await import(modulePath)
		const source = window.__zoltraakTestApi!.getShapes().map((s) => ({ ...s.props })) as any[]
		const text = source.find((s) => s.type === 'text')
		// Reproduce the data saved by the old decoration logic.
		text.text = text.originalText
		const normalize = createSceneNormalizer()
		const repaired = normalize(source)
		const repairedText = repaired.elements.find((s: any) => s.type === 'text')
		return { changed: repaired.changed, text: repairedText.text, id: repairedText.id, oldId: text.id,
			container: repairedText.containerId, oldContainer: text.containerId,
			bindings: repaired.elements[0].boundElements, oldBindings: source[0].boundElements,
			sourceUntouched: text.text === text.originalText,
			idempotent: !normalize(repaired.elements).changed }
	})
	expect(result.changed).toBe(true)
	expect(result.text).toContain('\n')
	expect(result.id).toBe(result.oldId)
	expect(result.container).toBe(result.oldContainer)
	expect(result.bindings).toEqual(result.oldBindings)
	expect(result.sourceUntouched).toBe(true)
	expect(result.idempotent).toBe(true)
	await page.getByRole('button', { name: 'Undo', exact: true }).click()
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().some((s) => s.type === 'text'))).toBe(false)
	await page.getByRole('button', { name: 'Redo', exact: true }).click()
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().find((s) => s.type === 'text')?.props.text)).toContain('\n')
})
