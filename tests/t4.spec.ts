import { expect, test } from '@playwright/test'

test('T4: command palette inserts a bundled default image at the cursor position', async ({
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

	await page.getByPlaceholder('Search pages...').fill('queue')

	const queueOption = page.getByRole('option', { exact: true, name: 'Queue' })
	await expect(queueOption).toBeVisible()
	await expect(queueOption.locator('.page-switcher__thumbnail')).toBeVisible()

	await page.keyboard.press('Enter')
	await expect(switcher).toBeHidden()

	await expect
		.poll(() =>
			page.evaluate(() =>
				window.__zoltraakTestApi!
					.getShapes()
					.filter(
						(shape) =>
							shape.type === 'image' &&
							(shape.props.customData as { defaultImageId?: string } | undefined)
								?.defaultImageId === 'queue'
					)
					.map((shape) => ({
						fileId: shape.props.fileId,
						height: shape.props.height,
						width: shape.props.width,
						x: shape.props.x,
						y: shape.props.y,
					}))
			)
		)
		.toEqual([
			expect.objectContaining({
				fileId: 'default-image-queue',
				height: 96,
				width: 200,
				x: expect.closeTo(cursor.x - 100, 2),
				y: expect.closeTo(cursor.y - 48, 2),
			}),
		])

	await page.reload()
	await page.waitForFunction(() => window.__zoltraakTestApi)

	await expect
		.poll(() =>
			page.evaluate(() =>
				window.__zoltraakTestApi!
					.getShapes()
					.some(
						(shape) =>
							shape.type === 'image' &&
							(shape.props.customData as { defaultImageId?: string } | undefined)
								?.defaultImageId === 'queue'
					)
			)
		)
		.toBe(true)
})
