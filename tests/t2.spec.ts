import { expect, test } from '@playwright/test'

test('T2: Command+K creates and switches between Excalidraw pages', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi)
	await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())

	const initialPageId = await page.evaluate(() => window.__zoltraakTestApi!.getCurrentPageId())

	await page.keyboard.press('Meta+K')
	await expect(page.getByRole('dialog', { name: 'Page switcher' })).toBeVisible()
	await expect(page.getByPlaceholder('Search pages...')).toBeFocused()

	await page.getByRole('option', { name: /Create new page/ }).click()

	await expect
		.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getPages().length))
		.toBe(2)

	const secondPageId = await page.evaluate(() => window.__zoltraakTestApi!.getCurrentPageId())
	expect(secondPageId).not.toBe(initialPageId)

	await page.keyboard.press('Meta+K')
	await page.getByPlaceholder('Search pages...').fill('Page 1')
	await page.keyboard.press('Enter')

	await expect
		.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getCurrentPageId()))
		.toBe(initialPageId)
})

test('T2: pages and active page persist after reload', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi)
	await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())

	await page.keyboard.press('Meta+K')
	await page.getByRole('option', { name: /Create new page/ }).click()

	await page.keyboard.press('r')
	await page.mouse.move(220, 180)
	await page.mouse.down()
	await page.mouse.move(420, 320)
	await page.mouse.up()

	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(1)

	const currentPageId = await page.evaluate(() => window.__zoltraakTestApi!.getCurrentPageId())

	await page.reload()
	await page.waitForFunction(() => window.__zoltraakTestApi)

	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getPages().length)).toBe(2)
	await expect
		.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getCurrentPageId()))
		.toBe(currentPageId)
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(1)
})

test('T2: Command+K opens page switcher after drawing on the canvas', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi)
	await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())

	await page.keyboard.press('r')
	await page.mouse.move(220, 180)
	await page.mouse.down()
	await page.mouse.move(420, 320)
	await page.mouse.up()

	await page.keyboard.press('Meta+K')
	await expect(page.getByRole('dialog', { name: 'Page switcher' })).toBeVisible()
})

test('T2: Command+K opens Excalidraw Mermaid dialog', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi)
	await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())

	await page.keyboard.press('Meta+K')
	await page.getByRole('option', { name: 'Insert Mermaid diagram' }).click()

	const mermaidDialog = page.getByRole('dialog').filter({ hasText: 'Mermaid to Excalidraw' })

	await expect(mermaidDialog).toBeVisible()
	await expect(mermaidDialog.getByRole('textbox', { name: /Write Mermaid diagram/i })).toBeVisible()
})

test('T2: Command+K opens page switcher from focused editor content', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi)
	await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())
	await page.evaluate(() => {
		const editorRoot = document.createElement('div')

		editorRoot.tabIndex = 0
		editorRoot.addEventListener('keydown', (event) => event.stopPropagation())
		document.querySelector('main')?.append(editorRoot)
		editorRoot.focus()
	})

	await page.keyboard.press('Meta+K')
	await expect(page.getByRole('dialog', { name: 'Page switcher' })).toBeVisible()
})

test('T2: Escape and outside click close the page switcher', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi)
	await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())

	await page.keyboard.press('Meta+K')
	await expect(page.getByRole('dialog', { name: 'Page switcher' })).toBeVisible()

	await page.keyboard.press('Escape')
	await expect(page.getByRole('dialog', { name: 'Page switcher' })).toBeHidden()

	await page.keyboard.press('Meta+K')
	await expect(page.getByRole('dialog', { name: 'Page switcher' })).toBeVisible()

	await page.mouse.click(20, 20)
	await expect(page.getByRole('dialog', { name: 'Page switcher' })).toBeHidden()
})
