import React from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

type UseCanvasShortcutsOptions = {
	apiRef: React.RefObject<ExcalidrawImperativeAPI | null>
	onOpenPageSwitcher: () => void
}

function isTextInputTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false

	return (
		target.isContentEditable ||
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement
	)
}

export function useCanvasShortcuts({ apiRef, onOpenPageSwitcher }: UseCanvasShortcutsOptions) {
	React.useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (isTextInputTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return

			if (event.key === 'r') {
				event.preventDefault()
				apiRef.current?.updateScene({
					appState: {
						currentItemRoughness: 0,
						currentItemRoundness: 'round',
					},
				})
				apiRef.current?.setActiveTool({ type: 'rectangle' })
				return
			}

			if (event.key === 'a') {
				event.preventDefault()
				apiRef.current?.setActiveTool({ type: 'arrow' })
			}
		}

		window.addEventListener('keydown', handleKeyDown)

		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [apiRef])

	React.useEffect(() => {
		function handlePageSwitcherShortcut(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault()
				onOpenPageSwitcher()
			}
		}

		window.addEventListener('keydown', handlePageSwitcherShortcut, { capture: true })

		return () => window.removeEventListener('keydown', handlePageSwitcherShortcut, { capture: true })
	}, [onOpenPageSwitcher])
}
