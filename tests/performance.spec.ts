import { expect, test } from '@playwright/test'

test('drawing stays responsive and saves only a small batch of changes', async ({ page }, testInfo) => {
	test.setTimeout(60_000)
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())
	await page.keyboard.press('r')
	await page.mouse.move(220, 180)
	await page.mouse.down()
	await page.mouse.move(420, 320)
	await page.mouse.up()
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(1)
	await page.waitForTimeout(800)

	// A real stored document with ten pages and 5,000 shapes. Only one page is visible.
	await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve) => {
			const request = indexedDB.open('zoltraak')
			request.onsuccess = () => resolve(request.result)
		})
		const transaction = db.transaction(['documents', 'pages'], 'readwrite')
		const store = transaction.objectStore('documents')
		const document = await new Promise<any>((resolve) => {
			const request = store.get('zoltraak-canvas')
			request.onsuccess = () => resolve(request.result)
		})
		const first = await new Promise<any>((resolve) => {
			const request = transaction.objectStore('pages').get(document.pageIds[0])
			request.onsuccess = () => resolve(request.result)
		})
		const shape = first.elements[0]
		const pages = Array.from({ length: 10 }, (_, pageIndex) => ({
			...first,
			id: pageIndex === 0 ? first.id : `benchmark-page-${pageIndex}`,
			name: `Page ${pageIndex + 1}`,
			elements: Array.from({ length: 500 }, (_, index) => ({
				...shape, id: `benchmark-${pageIndex}-${index}`, x: 2000 + index * 220,
			})),
		}))
		for (const page of pages) transaction.objectStore('pages').put(page, page.id)
		store.put({ ...document, pageIds: pages.map((page) => page.id) }, 'zoltraak-canvas')
		await new Promise<void>((resolve) => { transaction.oncomplete = () => resolve() })
		db.close()
	})
	await page.reload()
	await page.waitForFunction(() => window.__zoltraakTestApi?.getShapes().length === 500)
	await page.waitForTimeout(800)

	await page.evaluate(() => {
		const metrics = { writes: 0, saveBatches: 0, broadcasts: 0, broadcastBytes: 0, frames: [] as number[], running: true }
		;(window as any).__speedMetrics = metrics
		const originalPut = IDBObjectStore.prototype.put
		IDBObjectStore.prototype.put = function (...args) {
			metrics.writes += 1
			if (this.name === 'documents') metrics.saveBatches += 1
			return originalPut.apply(this, args)
		}
		const originalBroadcast = BroadcastChannel.prototype.postMessage
		BroadcastChannel.prototype.postMessage = function (message) {
			metrics.broadcasts += 1
			metrics.broadcastBytes += new TextEncoder().encode(JSON.stringify(message)).length
			return originalBroadcast.call(this, message)
		}
		let previous = performance.now()
		function sample(now: number) {
			metrics.frames.push(now - previous)
			previous = now
			if (metrics.running) requestAnimationFrame(sample)
		}
		requestAnimationFrame(sample)
	})
	await page.keyboard.press('r')
	await page.mouse.move(220, 180)
	await page.mouse.down()
	await page.mouse.move(720, 420, { steps: 60 })
	await page.mouse.up()
	await page.waitForTimeout(800)
	const metrics = await page.evaluate(() => {
		const metrics = (window as any).__speedMetrics
		metrics.running = false
		const sorted = [...metrics.frames].sort((a, b) => a - b)
		return {
			writes: metrics.writes, saveBatches: metrics.saveBatches, broadcasts: metrics.broadcasts,
			broadcastBytes: metrics.broadcastBytes,
			frameP95Ms: sorted[Math.floor(sorted.length * 0.95)],
			maxFrameMs: sorted.at(-1),
		}
	})
	console.log('Drawing performance:', JSON.stringify(metrics))
	await testInfo.attach('drawing-performance', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' })
	if (!process.env.PERFORMANCE_BASELINE) {
		expect(metrics.writes).toBeLessThanOrEqual(10)
		expect(metrics.broadcasts).toBeLessThanOrEqual(10)
		expect(metrics.broadcastBytes).toBeLessThan(1_000_000)
		expect(metrics.frameP95Ms).toBeLessThan(25)
	}
	await page.reload()
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getShapes().length)).toBe(501)
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getPages().length)).toBe(10)
})

test('selection and pointer movement do not save or broadcast the document', async ({ page }) => {
	await page.goto('/')
	await page.waitForFunction(() => window.__zoltraakTestApi?.getCurrentToolId())
	await page.evaluate(() => window.__zoltraakTestApi!.resetDocument())
	await page.keyboard.press('r')
	await page.mouse.move(220, 180)
	await page.mouse.down()
	await page.mouse.move(420, 320)
	await page.mouse.up()
	await page.waitForTimeout(600)
	await page.evaluate(() => {
		;(window as any).__idleWork = { writes: 0, broadcasts: 0 }
		const put = IDBObjectStore.prototype.put
		IDBObjectStore.prototype.put = function (...args) {
			;(window as any).__idleWork.writes += 1
			return put.apply(this, args)
		}
		const post = BroadcastChannel.prototype.postMessage
		BroadcastChannel.prototype.postMessage = function (value) {
			;(window as any).__idleWork.broadcasts += 1
			return post.call(this, value)
		}
	})
	await page.keyboard.press('v')
	await page.mouse.click(320, 180)
	await expect.poll(() => page.evaluate(() => window.__zoltraakTestApi!.getSelectedShapeIds().length)).toBe(1)
	await page.mouse.move(700, 500, { steps: 30 })
	await page.waitForTimeout(400)
	expect(await page.evaluate(() => (window as any).__idleWork)).toEqual({ writes: 0, broadcasts: 0 })
})
