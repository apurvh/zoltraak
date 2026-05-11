import React from 'react'
import { renderMermaidToSvg, svgToDataUrl } from '../lib/mermaid'

export type MermaidSubmitResult = {
	source: string
	dataUrl: string
	width: number
	height: number
	elementId: string | null
}

type MermaidEditorProps = {
	editingElementId: string | null
	initialSource: string
	isOpen: boolean
	onClose: () => void
	onSubmit: (result: MermaidSubmitResult) => void
}

const DEFAULT_SOURCE = `flowchart TD
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[Car]`

export function MermaidEditor({
	editingElementId,
	initialSource,
	isOpen,
	onClose,
	onSubmit,
}: MermaidEditorProps) {
	const [source, setSource] = React.useState('')
	const [previewSvg, setPreviewSvg] = React.useState('')
	const [previewWidth, setPreviewWidth] = React.useState(0)
	const [previewHeight, setPreviewHeight] = React.useState(0)
	const [error, setError] = React.useState('')
	const [isRendering, setIsRendering] = React.useState(false)
	const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
	const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

	React.useEffect(() => {
		if (!isOpen) return

		const startSource = initialSource || DEFAULT_SOURCE
		setSource(startSource)
		setError('')
		setPreviewSvg('')
		setIsRendering(false)

		window.requestAnimationFrame(() => textareaRef.current?.focus())

		// Render the initial source immediately
		renderPreview(startSource)

		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen])

	async function renderPreview(text: string) {
		if (!text.trim()) {
			setPreviewSvg('')
			setError('')
			return
		}

		setIsRendering(true)

		try {
			const result = await renderMermaidToSvg(text)
			setPreviewSvg(result.svg)
			setPreviewWidth(result.width)
			setPreviewHeight(result.height)
			setError('')
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Invalid Mermaid syntax')
		} finally {
			setIsRendering(false)
		}
	}

	function handleSourceChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
		const value = event.currentTarget.value
		setSource(value)

		if (debounceRef.current) clearTimeout(debounceRef.current)
		debounceRef.current = setTimeout(() => renderPreview(value), 500)
	}

	function handleSubmit() {
		if (!previewSvg || error) return

		onSubmit({
			source,
			dataUrl: svgToDataUrl(previewSvg),
			width: previewWidth,
			height: previewHeight,
			elementId: editingElementId,
		})
	}

	function handleKeyDown(event: React.KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault()
			onClose()
			return
		}

		if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
			event.preventDefault()
			handleSubmit()
		}
	}

	if (!isOpen) return null

	const isEditing = editingElementId !== null
	const canSubmit = !!previewSvg && !error && !isRendering

	return (
		<div className="mermaid-editor-backdrop" onMouseDown={onClose}>
			<div
				aria-label="Mermaid editor"
				aria-modal="true"
				className="mermaid-editor"
				onKeyDown={handleKeyDown}
				onMouseDown={(event) => event.stopPropagation()}
				role="dialog"
			>
				<div className="mermaid-editor__header">
					<div className="mermaid-editor__header-text">
						<h2 className="mermaid-editor__title">
							{isEditing ? 'Edit Mermaid Diagram' : 'Insert Mermaid Diagram'}
						</h2>
						<p className="mermaid-editor__subtitle">
							Write Mermaid syntax and preview the diagram. Double-click to edit later.
						</p>
					</div>
					<div className="mermaid-editor__header-actions">
						<button
							className="mermaid-editor__submit"
							disabled={!canSubmit}
							onClick={handleSubmit}
							type="button"
						>
							{isEditing ? 'Update' : 'Insert'} →
						</button>
					</div>
				</div>

				<div className="mermaid-editor__body">
					<div className="mermaid-editor__panel">
						<textarea
							aria-label="Mermaid Syntax"
							className="mermaid-editor__textarea"
							id="mermaid-source"
							onChange={handleSourceChange}
							placeholder="Enter Mermaid syntax..."
							ref={textareaRef}
							spellCheck={false}
							value={source}
						/>
					</div>

					<div className="mermaid-editor__panel">
						<div className="mermaid-editor__preview">
							{error ? (
								<div className="mermaid-editor__error">{error}</div>
							) : previewSvg ? (
								<div
									className="mermaid-editor__preview-svg"
									dangerouslySetInnerHTML={{ __html: previewSvg }}
								/>
							) : (
								<div className="mermaid-editor__placeholder">
									{isRendering ? 'Rendering…' : 'Preview will appear here'}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
