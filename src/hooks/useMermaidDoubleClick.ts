import React from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

type UseMermaidDoubleClickOptions = {
	apiRef: React.RefObject<ExcalidrawImperativeAPI | null>
	onEditMermaid: (elementId: string, source: string) => void
}

export function useMermaidDoubleClick({ apiRef, onEditMermaid }: UseMermaidDoubleClickOptions) {
	React.useEffect(() => {
		function handleDoubleClick() {
			const api = apiRef.current
			if (!api) return

			const selectedIds = Object.keys(api.getAppState().selectedElementIds)
			if (selectedIds.length !== 1) return

			const element = api.getSceneElements().find((el) => el.id === selectedIds[0])
			if (!element) return

			const customData = (element as { customData?: { mermaidSource?: string } }).customData
			if (!customData?.mermaidSource) return

			onEditMermaid(element.id, customData.mermaidSource)
		}

		document.addEventListener('dblclick', handleDoubleClick)

		return () => document.removeEventListener('dblclick', handleDoubleClick)
	}, [apiRef, onEditMermaid])
}
