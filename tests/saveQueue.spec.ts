import { expect, test } from '@playwright/test'
import { SaveQueue } from '../src/lib/saveQueue'

function deferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (reason?: unknown) => void
	const promise = new Promise<T>((promiseResolve, promiseReject) => {
		resolve = promiseResolve
		reject = promiseReject
	})

	return { promise, reject, resolve }
}

test('save queue continues after a failed save', async () => {
	const saved: string[] = []
	const errors: unknown[] = []
	let shouldFail = true
	const queue = new SaveQueue<string>(
		async (value) => {
			if (shouldFail) {
				shouldFail = false
				throw new Error('forced save failure')
			}

			saved.push(value)
		},
		(error) => errors.push(error)
	)

	await queue.enqueue('first')
	await queue.enqueue('second')

	expect(saved).toEqual(['second'])
	expect(errors).toHaveLength(1)
})

test('save queue writes reset after earlier queued saves complete', async () => {
	const saved: string[] = []
	const firstSave = deferred<void>()
	const queue = new SaveQueue<string>(async (value) => {
		if (value === 'stale') {
			await firstSave.promise
		}

		saved.push(value)
	})

	const staleSave = queue.enqueue('stale')
	const resetSave = queue.enqueue('reset')

	expect(saved).toEqual([])
	firstSave.resolve()
	await staleSave
	await resetSave

	expect(saved).toEqual(['stale', 'reset'])
})

test('a burst saves the latest snapshot and flush preserves reset order', async () => {
	const saved: string[] = []
	const queue = new SaveQueue<string>(async (value) => { saved.push(value) })
	for (let index = 0; index < 100; index += 1) queue.schedule(`drawing-${index}`)
	await queue.flush()
	expect(saved).toEqual(['drawing-99'])
	queue.schedule('final-drawing')
	await queue.enqueue('reset')
	expect(saved).toEqual(['drawing-99', 'final-drawing', 'reset'])
})
