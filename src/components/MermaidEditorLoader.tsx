import React from 'react'
import editorUrl from 'virtual:mermaid-editor-url'

type EditorModule = typeof import('./MermaidEditor')
type Editor = EditorModule['MermaidEditor']

let pending: Promise<EditorModule> | undefined
let attempts = 0

function loadEditor(): Promise<EditorModule> {
	if (!pending) {
		const attempt = attempts++
		const url = new URL(editorUrl, document.baseURI)
		url.searchParams.set('mermaid-retry', String(attempt))
		// Keep the first import visible to Vite's dependency scanner. Browsers need a
		// fresh module URL after a failed request, even when the network has recovered.
		const request: Promise<EditorModule> = attempt === 0
			? import('./MermaidEditor')
			: import(/* @vite-ignore */ url.href)
		pending = request.catch((error) => {
			pending = undefined
			throw error
		})
	}
	return pending
}

export function MermaidEditorLoader(props: React.ComponentProps<Editor>) {
	const [Editor, setEditor] = React.useState<Editor | null>(null)
	const [failed, setFailed] = React.useState(false)
	const [attempt, setAttempt] = React.useState(0)
	React.useEffect(() => {
		let active = true
		loadEditor().then(
			({ MermaidEditor }) => { if (active) setEditor(() => MermaidEditor) },
			() => { if (active) setFailed(true) },
		)
		return () => { active = false }
	}, [attempt])

	if (Editor) return <Editor {...props} />
	return (
		<div className="mermaid-editor-backdrop">
			<div aria-label="Diagram editor" aria-modal="true" role="dialog"
				className={`mermaid-editor mermaid-editor--loading mermaid-editor--${props.theme}`}>
				<p className="mermaid-editor__title" role="status">
					{failed ? 'Could not load the diagram editor.' : 'Loading diagram editor…'}
				</p>
				<div className="mermaid-editor__header-actions">
					<button type="button" autoFocus onClick={props.onClose}>Close</button>
					{failed && <button type="button" className="mermaid-editor__submit" onClick={() => {
						setFailed(false)
						setAttempt((value) => value + 1)
					}}>Retry</button>}
				</div>
			</div>
		</div>
	)
}
