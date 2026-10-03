import { expect, test } from '@playwright/test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const defaultImagesDirectory = join(process.cwd(), 'src/assets/default-images')

test('T4: bundled default SVGs use thin transparent strokes', () => {
	const svgFiles = readdirSync(defaultImagesDirectory).filter((file) => file.endsWith('.svg'))

	expect(svgFiles.length).toBeGreaterThan(0)

	for (const file of svgFiles) {
		const svg = readFileSync(join(defaultImagesDirectory, file), 'utf8')

		expect(svg, `${file} should not have white fills`).not.toContain('fill="#ffffff"')
		expect(svg, `${file} should not use the old thick stroke width`).not.toContain(
			'stroke-width="4"'
		)
		expect(svg, `${file} should use the 30% thinner stroke width`).toContain(
			'stroke-width="2.8"'
		)
	}
})

for (const { imageId, label, width, height } of [
	{ imageId: 'queue', label: 'Queue', width: 200, height: 96 },
	{ imageId: 'cache', label: 'Cache', width: 160, height: 160 },
]) {
	test(`T4: command palette inserts ${imageId} at the cursor position`, async ({
		page,
	}) => {
		await page.goto('/')
		await page.waitForFunction(() => window.__zoltraakTestApi)
		await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())

		const cursor = { x: 320, y: 240 }
		await page.mouse.move(cursor.x, cursor.y)
		await page.keyboard.press('Meta+K')

		const switcher = page.getByRole('dialog', { name: 'Page switcher' })
		await expect(switcher).toBeVisible()

		await page.getByPlaceholder('Search pages...').fill(imageId)

		const imageOption = page.getByRole('option', { exact: true, name: label })
		await expect(imageOption).toBeVisible()
		await expect(imageOption.locator('.page-switcher__thumbnail')).toBeVisible()

		await page.keyboard.press('Enter')
		await expect(switcher).toBeHidden()

		await expect
			.poll(() =>
				page.evaluate(
					(id) =>
						window.__zoltraakTestApi!
							.getShapes()
							.filter(
								(shape) =>
									shape.type === 'image' &&
									(shape.props.customData as { defaultImageId?: string } | undefined)
										?.defaultImageId === id
							)
							.map((shape) => ({
								fileId: shape.props.fileId,
								height: shape.props.height,
								width: shape.props.width,
								x: shape.props.x,
								y: shape.props.y,
							})),
					imageId,
				)
			)
			.toEqual([
				expect.objectContaining({
					fileId: `default-image-${imageId}${imageId === 'cache' ? '-v2' : ''}`,
					height,
					width,
					x: expect.closeTo(cursor.x - width / 2, 2),
					y: expect.closeTo(cursor.y - height / 2, 2),
				}),
			])
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().find((shape) => shape.type === 'text')?.props.text)).toBe(label)
		await page.getByRole('button', { name: 'Undo', exact: true }).click()
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(0)
		await page.getByRole('button', { name: 'Redo', exact: true }).click()
		await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(2)

		await page.reload()
		await page.waitForFunction(() => window.__zoltraakTestApi)

		await expect
			.poll(() =>
				page.evaluate(
					(id) =>
						window.__zoltraakTestApi!
							.getShapes()
							.some(
								(shape) =>
									shape.type === 'image' &&
									(shape.props.customData as { defaultImageId?: string } | undefined)
									?.defaultImageId === id
							),
					imageId,
				)
			)
			.toBe(true)
	})
}
