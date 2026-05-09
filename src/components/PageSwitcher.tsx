import React from 'react'
import { getNextPageName, type PageSummary } from '../lib/document'

type PageSwitcherProps = {
	currentPageId: string
	isOpen: boolean
	onClose: () => void
	onCreatePage: (name: string) => void
	onSwitchPage: (pageId: string) => void
	pages: PageSummary[]
}

function getFilteredPageOptions(pages: PageSummary[], query: string) {
	const normalizedQuery = query.trim().toLowerCase()
	const filteredPages = normalizedQuery
		? pages.filter((page) => page.name.toLowerCase().includes(normalizedQuery))
		: pages

	return normalizedQuery
		? [
				...filteredPages.map((page) => ({ type: 'page' as const, page })),
				{ type: 'create' as const, page: null },
			]
		: [
				{ type: 'create' as const, page: null },
				...filteredPages.map((page) => ({ type: 'page' as const, page })),
			]
}

export function PageSwitcher({
	currentPageId,
	isOpen,
	onClose,
	onCreatePage,
	onSwitchPage,
	pages,
}: PageSwitcherProps) {
	const [query, setQuery] = React.useState('')
	const [highlightedIndex, setHighlightedIndex] = React.useState(0)
	const inputRef = React.useRef<HTMLInputElement | null>(null)

	React.useEffect(() => {
		if (!isOpen) return

		setQuery('')
		setHighlightedIndex(0)
		window.requestAnimationFrame(() => inputRef.current?.focus())
	}, [isOpen])

	const options = getFilteredPageOptions(pages, query)

	React.useEffect(() => {
		setHighlightedIndex((index) => Math.min(index, Math.max(options.length - 1, 0)))
	}, [options.length])

	const createPage = React.useCallback(() => {
		const name = query.trim() || getNextPageName(pages)

		onCreatePage(name)
		onClose()
	}, [onClose, onCreatePage, pages, query])

	const switchToPage = React.useCallback(
		(pageId: string) => {
			onSwitchPage(pageId)
			onClose()
		},
		[onClose, onSwitchPage]
	)

	const selectOption = React.useCallback(
		(index: number) => {
			const option = options[index]
			if (!option) return

			if (option.type === 'create') {
				createPage()
			} else {
				switchToPage(option.page.id)
			}
		},
		[createPage, options, switchToPage]
	)

	if (!isOpen) return null

	return (
		<div className="page-switcher-backdrop" onMouseDown={onClose}>
			<div
				aria-label="Page switcher"
				aria-modal="true"
				className="page-switcher"
				onMouseDown={(event) => event.stopPropagation()}
				role="dialog"
			>
				<input
					aria-label="Search pages"
					className="page-switcher__input"
					onChange={(event) => {
						setQuery(event.currentTarget.value)
						setHighlightedIndex(0)
					}}
					onKeyDown={(event) => {
						if (event.key === 'Escape') {
							event.preventDefault()
							onClose()
							return
						}

						if (event.key === 'ArrowDown') {
							event.preventDefault()
							setHighlightedIndex((index) => Math.min(index + 1, options.length - 1))
							return
						}

						if (event.key === 'ArrowUp') {
							event.preventDefault()
							setHighlightedIndex((index) => Math.max(index - 1, 0))
							return
						}

						if (event.key === 'Enter') {
							event.preventDefault()
							selectOption(highlightedIndex)
						}
					}}
					placeholder="Search pages..."
					ref={inputRef}
					value={query}
				/>
				<div aria-label="Pages" className="page-switcher__list" role="listbox">
					{options.map((option, index) => {
						const isHighlighted = index === highlightedIndex

						if (option.type === 'create') {
							const label = query.trim() ? `Create new page "${query.trim()}"` : 'Create new page'

							return (
								<button
									aria-selected={isHighlighted}
									className="page-switcher__option"
									key="create"
									onClick={createPage}
									onMouseEnter={() => setHighlightedIndex(index)}
									role="option"
									type="button"
								>
									<span className="page-switcher__option-title">{label}</span>
								</button>
							)
						}

						const isCurrent = option.page.id === currentPageId

						return (
							<button
								aria-selected={isHighlighted}
								className="page-switcher__option"
								key={option.page.id}
								onClick={() => switchToPage(option.page.id)}
								onMouseEnter={() => setHighlightedIndex(index)}
								role="option"
								type="button"
							>
								<span className="page-switcher__option-title">{option.page.name}</span>
								{isCurrent && <span className="page-switcher__option-meta">Current</span>}
							</button>
						)
					})}
				</div>
			</div>
		</div>
	)
}
