import React from 'react'
import { sceneCoordsToViewportCoords, viewportCoordsToSceneCoords } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { canConnectElement, connectToRight, edgeMidpoint } from '../lib/horizontalConnections'

type Handle = { id: string; x: number; y: number; height: number; angle: number }

export function HorizontalConnectors({ api, hidden }: { api: ExcalidrawImperativeAPI | null; hidden: boolean }) {
	const [handles, setHandles] = React.useState<Handle[]>([])
	React.useEffect(() => {
		if (!api || hidden) {
			setHandles([])
			return
		}
		let frame = 0
		function updateHandles() {
			frame = 0
			const appState = api!.getAppState()
			const nextHandles: Handle[] = []
			if (appState.activeTool.type === 'selection' && !appState.viewModeEnabled &&
				!appState.newElement && !appState.editingTextElement && !appState.isResizing &&
				!appState.isRotating && !appState.selectedElementsAreBeingDragged && !appState.openDialog) {
				for (const element of api!.getSceneElements()) {
					if (!canConnectElement(element)) continue
					const edge = edgeMidpoint(element, 'right')
					const point = sceneCoordsToViewportCoords({ sceneX: edge.x, sceneY: edge.y }, appState)
					if (point.x < 0 || point.y < 0 || point.x > window.innerWidth || point.y > window.innerHeight) continue
					nextHandles.push({ id: element.id, ...point, height: element.height * appState.zoom.value, angle: element.angle })
				}
			}
			setHandles((previous) => previous.length === nextHandles.length && previous.every((handle, index) => {
				const next = nextHandles[index]
				return handle.id === next.id && handle.x === next.x && handle.y === next.y &&
					handle.height === next.height && handle.angle === next.angle
			}) ? previous : nextHandles)
		}
		function scheduleUpdate() {
			if (!frame) frame = requestAnimationFrame(updateHandles)
		}
		const unsubscribe = api.onChange(scheduleUpdate)
		window.addEventListener('resize', scheduleUpdate)
		updateHandles()
		return () => {
			unsubscribe()
			cancelAnimationFrame(frame)
			window.removeEventListener('resize', scheduleUpdate)
		}
	}, [api, hidden])

	if (hidden || !api) return null
	return <div className="right-edge-connectors">
		{handles.map((handle) => <button
			key={handle.id}
			type="button"
			className="right-edge-connector"
			data-element-id={handle.id}
			aria-label="Connect horizontally to the first element on the right"
			style={{ left: handle.x, top: handle.y, height: handle.height, transform: `translate(-50%, -50%) rotate(${handle.angle}rad)` }}
			onPointerDown={(event) => { event.preventDefault(); event.stopPropagation() }}
			onClick={(event) => {
				event.stopPropagation()
				const click = event.detail === 0 ? undefined : viewportCoordsToSceneCoords(
					{ clientX: event.clientX, clientY: event.clientY }, api.getAppState())
				connectToRight(api, handle.id, click)
			}}
		/>)}
	</div>
}
