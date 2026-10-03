export class SaveQueue<T> {
	private chain: Promise<void> = Promise.resolve()
	private pending: { value: T } | undefined
	private timer: ReturnType<typeof setTimeout> | undefined

	constructor(
		private readonly save: (value: T) => Promise<void>,
		private readonly onError: (error: unknown) => void = () => {}
	) {}

	enqueue(value: T) {
		this.flush()
		return this.append(value)
	}

	// Keep the newest snapshot. Do not let frequent pointer updates starve saving.
	schedule(value: T, delay = 150) {
		this.pending = { value }
		if (this.timer === undefined) {
			this.timer = setTimeout(() => { void this.flush() }, delay)
		}
	}

	replacePending(value: T) {
		if (this.pending) this.pending = { value }
	}

	private append(value: T) {
		this.chain = this.chain
			.then(() => this.save(value))
			.catch((error) => {
				this.reportError(error)
			})

		return this.chain
	}

	flush() {
		if (this.timer !== undefined) clearTimeout(this.timer)
		this.timer = undefined
		if (this.pending) {
			const { value } = this.pending
			this.pending = undefined
			this.append(value)
		}
		return this.chain
	}

	private reportError(error: unknown) {
		try {
			this.onError(error)
		} catch {
			// Keep save failures isolated so future saves can continue.
		}
	}
}
