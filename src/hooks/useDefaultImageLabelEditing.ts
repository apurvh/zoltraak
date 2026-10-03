import React from 'react'
import { flushSync } from 'react-dom'
import { CaptureUpdateAction, viewportCoordsToSceneCoords } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

export function useDefaultImageLabelEditing(apiRef: React.RefObject<ExcalidrawImperativeAPI | null>) {
	React.useEffect(() => {
		function handleDoubleClick(event: MouseEvent) {
			if (!(event.target instanceof HTMLCanvasElement)) return
			const api = apiRef.current
			if (!api) return
			const state = api.getAppState()
			if (state.activeTool.type !== 'selection' || state.viewModeEnabled || state.editingTextElement) return
			const point = viewportCoordsToSceneCoords(event, state)
			const hit = [...api.getSceneElements()].reverse().find((element) => {
				const dx = point.x - element.x - element.width / 2
				const dy = point.y - element.y - element.height / 2
				return Math.abs(dx * Math.cos(element.angle) + dy * Math.sin(element.angle)) <= element.width / 2 &&
					Math.abs(-dx * Math.sin(element.angle) + dy * Math.cos(element.angle)) <= element.height / 2
			})
			if (hit?.type !== 'text' || !hit.customData?.defaultImageLabelFor || hit.locked) return
			// Enter the group before the native double-click handler opens its text editor.
			flushSync(() => api.updateScene({
				appState: {
					editingGroupId: hit.groupIds.at(-1) ?? null,
					selectedElementIds: { [hit.id]: true },
					selectedGroupIds: {},
				},
				captureUpdate: CaptureUpdateAction.EVENTUALLY,
			}))
		}
		document.addEventListener('dblclick', handleDoubleClick, { capture: true })
		return () => document.removeEventListener('dblclick', handleDoubleClick, { capture: true })
	}, [apiRef])
}
