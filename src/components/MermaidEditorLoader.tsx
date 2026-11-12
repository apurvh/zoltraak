import React from 'react'
import editorUrl from 'virtual:mermaid-editor-url'

type EditorModule = typeof import('./MermaidEditor')
type Editor = EditorModule['MermaidEditor']

let pending: Promise<EditorModule> | undefined
let attempts = 0

function loadEditor(): Promise<EditorModule> {
	if (!pending) {
		const url = new URL(editorUrl, document.baseURI)
		// Browsers remember failed module requests for the lifetime of the tab.
		if (attempts > 0) url.searchParams.set('mermaid-retry', String(attempts))
		attempts++
		pending = (import(/* @vite-ignore */ url.href) as Promise<EditorModule>).catch((error) => {
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
