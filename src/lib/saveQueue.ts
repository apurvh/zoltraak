export class SaveQueue<T> {
	private chain: Promise<void> = Promise.resolve()

	constructor(
		private readonly save: (value: T) => Promise<void>,
		private readonly onError: (error: unknown) => void = () => {}
	) {}

	enqueue(value: T) {
		this.chain = this.chain
			.then(() => this.save(value))
			.catch((error) => {
				this.reportError(error)
			})

		return this.chain
	}

	flush() {
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
