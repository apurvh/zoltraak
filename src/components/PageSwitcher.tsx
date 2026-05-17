import React from 'react'
import { type DefaultImage, defaultImages, matchesDefaultImage } from '../lib/defaultImages'
import { getNextPageName, type PageSummary } from '../lib/document'
import { FileIcon, FilePlusIcon, WandIcon } from './icons'

type PageSwitcherProps = {
	currentPageId: string
	isOpen: boolean
	onClose: () => void
	onCreatePage: (name: string) => void
	onInsertDefaultImage: (image: DefaultImage) => void
	onOpenMermaidToExcalidraw: () => void
	onSwitchPage: (pageId: string) => void
	pages: PageSummary[]
}

type CommandOption = { type: 'command'; id: 'mermaid-to-excalidraw'; label: string }

const commandOptions: CommandOption[] = [
	{ type: 'command', id: 'mermaid-to-excalidraw', label: 'Insert Mermaid diagram' },
]

function getFilteredPageOptions(pages: PageSummary[], query: string) {
	const normalizedQuery = query.trim().toLowerCase()
	const filteredPages = normalizedQuery
		? pages.filter((page) => page.name.toLowerCase().includes(normalizedQuery))
		: pages
	const filteredCommands = normalizedQuery
		? commandOptions.filter((command) => command.label.toLowerCase().includes(normalizedQuery))
		: commandOptions
	const filteredDefaultImages = defaultImages.filter((image) =>
		matchesDefaultImage(image, normalizedQuery)
	)

	return normalizedQuery
		? [
				...filteredPages.map((page) => ({ type: 'page' as const, page })),
				...filteredDefaultImages.map((image) => ({ type: 'default-image' as const, image })),
				...filteredCommands,
				{ type: 'create' as const, page: null },
			]
		: [
				...filteredPages.map((page) => ({ type: 'page' as const, page })),
				{ type: 'create' as const, page: null },
				...filteredDefaultImages.map((image) => ({ type: 'default-image' as const, image })),
				...commandOptions,
			]
}

// --- Shared option button to reduce duplication across option types ---

type OptionButtonProps = {
	icon: React.ReactNode
	isHighlighted: boolean
	label: string
	meta?: React.ReactNode
	onClick: () => void
	onMouseEnter: () => void
}

function OptionButton({ icon, isHighlighted, label, meta, onClick, onMouseEnter }: OptionButtonProps) {
	return (
		<button
			aria-selected={isHighlighted}
			className="page-switcher__option"
			onClick={onClick}
			onMouseEnter={onMouseEnter}
			role="option"
			type="button"
		>
			<div className="page-switcher__option-content">
				{icon}
				<span className="page-switcher__option-title">{label}</span>
			</div>
			{meta}
		</button>
	)
}

// --- Main component ---

export function PageSwitcher({
	currentPageId,
	isOpen,
	onClose,
	onCreatePage,
	onInsertDefaultImage,
	onOpenMermaidToExcalidraw,
	onSwitchPage,
	pages,
}: PageSwitcherProps) {
	const [query, setQuery] = React.useState('')
	const [highlightedIndex, setHighlightedIndex] = React.useState(0)
	const hasNavigatedOptionsRef = React.useRef(false)
	const inputRef = React.useRef<HTMLInputElement | null>(null)

	React.useEffect(() => {
		if (!isOpen) return

		setQuery('')
		setHighlightedIndex(0)
		hasNavigatedOptionsRef.current = false
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

	const openMermaidToExcalidraw = React.useCallback(() => {
		onClose()
		onOpenMermaidToExcalidraw()
	}, [onClose, onOpenMermaidToExcalidraw])

	const insertDefaultImage = React.useCallback(
		(image: DefaultImage) => {
			onClose()
			onInsertDefaultImage(image)
		},
		[onClose, onInsertDefaultImage]
	)

	const selectOption = React.useCallback(
		(index: number) => {
			const option = options[index]
			if (!option) return

			if (option.type === 'create') {
				createPage()
			} else if (option.type === 'command') {
				openMermaidToExcalidraw()
			} else if (option.type === 'default-image') {
				insertDefaultImage(option.image)
			} else {
				switchToPage(option.page.id)
			}
		},
		[createPage, insertDefaultImage, openMermaidToExcalidraw, options, switchToPage]
	)

	if (!isOpen) return null

	const firstCommandIndex = options.findIndex((o) => o.type === 'command')
	const firstImageIndex = options.findIndex((o) => o.type === 'default-image')
	const firstPageIndex = options.findIndex((o) => o.type === 'page')

	const handleMouseEnter = (index: number) => {
		hasNavigatedOptionsRef.current = true
		setHighlightedIndex(index)
	}

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
						hasNavigatedOptionsRef.current = false
					}}
					onKeyDown={(event) => {
						if (event.key === 'Escape') {
							event.preventDefault()
							onClose()
							return
						}

						if (event.key === 'ArrowDown') {
							event.preventDefault()
							hasNavigatedOptionsRef.current = true
							setHighlightedIndex((index) => Math.min(index + 1, options.length - 1))
							return
						}

						if (event.key === 'ArrowUp') {
							event.preventDefault()
							hasNavigatedOptionsRef.current = true
							setHighlightedIndex((index) => Math.max(index - 1, 0))
							return
						}

						if (event.key === 'Enter') {
							event.preventDefault()
							selectOption(hasNavigatedOptionsRef.current ? highlightedIndex : 0)
						}
					}}
					placeholder="Search pages..."
					ref={inputRef}
					value={query}
				/>
				<div aria-label="Pages" className="page-switcher__list" role="listbox">
					{options.map((option, index) => {
						const isHighlighted = index === highlightedIndex
						const showPagesHeading = index === firstPageIndex

						let key: string
						let optionButton: React.ReactNode

						if (option.type === 'command') {
							key = option.id
							optionButton = (
								<OptionButton
									icon={<WandIcon className="page-switcher__icon" />}
									isHighlighted={isHighlighted}
									label={option.label}
									onClick={openMermaidToExcalidraw}
									onMouseEnter={() => handleMouseEnter(index)}
								/>
							)
						} else if (option.type === 'default-image') {
							key = `default-image-${option.image.id}`
							optionButton = (
								<OptionButton
									icon={
										<img
											alt=""
											className="page-switcher__thumbnail"
											src={option.image.assetUrl}
										/>
									}
									isHighlighted={isHighlighted}
									label={option.image.label}
									onClick={() => insertDefaultImage(option.image)}
									onMouseEnter={() => handleMouseEnter(index)}
								/>
							)
						} else if (option.type === 'create') {
							key = 'create'
							optionButton = (
								<OptionButton
									icon={<FilePlusIcon className="page-switcher__icon" />}
									isHighlighted={isHighlighted}
									label={query.trim() ? `Create new page "${query.trim()}"` : 'Create new page'}
									onClick={createPage}
									onMouseEnter={() => handleMouseEnter(index)}
								/>
							)
						} else {
							key = option.page.id
							optionButton = (
								<OptionButton
									icon={<FileIcon className="page-switcher__icon" />}
									isHighlighted={isHighlighted}
									label={option.page.name}
									meta={
										option.page.id === currentPageId ? (
											<span className="page-switcher__option-meta">Current</span>
										) : undefined
									}
									onClick={() => switchToPage(option.page.id)}
									onMouseEnter={() => handleMouseEnter(index)}
								/>
							)
						}

						return (
							<React.Fragment key={key}>
								{showPagesHeading && <div className="page-switcher__heading">Pages</div>}
								{index === firstImageIndex && <div className="page-switcher__heading">Images</div>}
								{index === firstCommandIndex && <div className="page-switcher__heading">Commands</div>}
								{optionButton}
							</React.Fragment>
						)
					})}
				</div>
			</div>
		</div>
	)
}
