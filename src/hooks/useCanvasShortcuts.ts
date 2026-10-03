import React from 'react'
import { CaptureUpdateAction, convertToExcalidrawElements } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { defaultImages, getDefaultImageFileId } from '../lib/defaultImages'
import { hasDefaultImageName } from '../lib/defaultImageLabels'
import { DEFAULT_ARROWHEAD, SHAPE_ROUGHNESS } from '../lib/excalidrawScene'

type UseCanvasShortcutsOptions = {
	apiRef: React.RefObject<ExcalidrawImperativeAPI | null>
	onOpenPageSwitcher: () => void
}

const imageShortcuts: Readonly<Record<string, string>> = {
	s: 'stick-user',
	d: 'database',
	q: 'queue',
	c: 'cache',
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
		function handleCanvasShortcut(event: KeyboardEvent) {
			if (isTextInputTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
			const imageId = imageShortcuts[event.key]
			if (!imageId && event.key !== 'z') return

			const api = apiRef.current
			if (!api) return
			const appState = api.getAppState()
			if ((imageId && appState.viewModeEnabled) || appState.newElement || appState.selectionElement || appState.editingTextElement || appState.openDialog) return

			event.preventDefault()
			event.stopImmediatePropagation()
			if (event.repeat) return
			if (event.key === 'z') {
				// Match Reset Zoom: keep the scene point at the viewport center in place.
				const zoomOffset = 1 - 1 / appState.zoom.value
				api.updateScene({
					appState: {
						zoom: { value: 1 as typeof appState.zoom.value },
						scrollX: appState.scrollX + appState.width / 2 * zoomOffset,
						scrollY: appState.scrollY + appState.height / 2 * zoomOffset,
						userToFollow: null,
					},
					captureUpdate: CaptureUpdateAction.EVENTUALLY,
				})
				return
			}

			const image = defaultImages.find((image) => image.id === imageId)!
			const fileId = getDefaultImageFileId(image)
			const [element] = convertToExcalidrawElements([{
				type: 'image',
				x: 0,
				y: 0,
				width: 0,
				height: 0,
				fileId: fileId as any,
				status: 'saved',
				customData: {
					defaultImageId: image.id,
					...(hasDefaultImageName(image.id) ? { needsDefaultLabel: true } : {}),
				},
			}])

			// Use the native image placement flow. setActiveTool('image') opens a file picker.
			api.updateScene({
				elements: [
					...api.getSceneElementsIncludingDeleted().filter((element) => element.id !== appState.pendingImageElementId),
					element,
				],
				appState: {
					activeTool: { type: 'image', customType: null, locked: false, lastActiveTool: null },
					pendingImageElementId: element.id,
					selectedElementIds: {},
					selectedGroupIds: {},
					editingGroupId: null,
					multiElement: null,
				},
				captureUpdate: CaptureUpdateAction.EVENTUALLY,
			})
			const now = Date.now()
			api.addFiles([{
				id: fileId as any,
				dataURL: image.dataUrl as any,
				mimeType: image.mimeType,
				created: now,
				lastRetrieved: now,
			}])
			api.setCursor('crosshair')
		}

		window.addEventListener('keydown', handleCanvasShortcut, { capture: true })
		return () => window.removeEventListener('keydown', handleCanvasShortcut, { capture: true })
	}, [apiRef])

	React.useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (isTextInputTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return

			if (event.key === 'r') {
				event.preventDefault()
				apiRef.current?.updateScene({
					appState: {
						currentItemRoughness: SHAPE_ROUGHNESS,
						currentItemRoundness: 'round',
					},
				})
				apiRef.current?.setActiveTool({ type: 'rectangle' })
				return
			}

			if (event.key === 'a') {
				event.preventDefault()
				apiRef.current?.updateScene({
					appState: {
						currentItemEndArrowhead: DEFAULT_ARROWHEAD,
						currentItemRoughness: SHAPE_ROUGHNESS,
					},
				})
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
				event.stopImmediatePropagation()
				onOpenPageSwitcher()
			}
		}

		window.addEventListener('keydown', handlePageSwitcherShortcut, { capture: true })

		return () => window.removeEventListener('keydown', handlePageSwitcherShortcut, { capture: true })
	}, [onOpenPageSwitcher])
}
