import { CaptureUpdateAction, convertToExcalidrawElements, newElementWith } from '@excalidraw/excalidraw'
import type { ExcalidrawArrowElement, ExcalidrawBindableElement, ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { DEFAULT_ARROWHEAD, SHAPE_ROUGHNESS } from './excalidrawScene'

export function canConnectElement(element: ExcalidrawElement): element is ExcalidrawBindableElement {
	return !element.isDeleted && !element.locked && element.width > 0 && element.height > 0 &&
		element.type !== 'arrow' && element.type !== 'line' && element.type !== 'freedraw' &&
		element.type !== 'selection' && !(element.type === 'text' && element.containerId)
}

function edgePoint(element: ExcalidrawBindableElement, side: 'left' | 'right', ratio: number) {
	const offset = (side === 'right' ? 1 : -1) * element.width / 2
	const verticalOffset = (ratio - 0.5) * element.height
	return {
		x: element.x + element.width / 2 + Math.cos(element.angle) * offset - Math.sin(element.angle) * verticalOffset,
		y: element.y + element.height / 2 + Math.sin(element.angle) * offset + Math.cos(element.angle) * verticalOffset,
	}
}

export function edgeMidpoint(element: ExcalidrawBindableElement, side: 'left' | 'right') {
	return edgePoint(element, side, 0.5)
}

function leftEdgeIntersection(element: ExcalidrawBindableElement, start: { x: number; y: number }) {
	const top = edgePoint(element, 'left', 0)
	const bottom = edgePoint(element, 'left', 1)
	const dy = bottom.y - top.y
	if (Math.abs(dy) < 0.000001) {
		const x = Math.min(top.x, bottom.x)
		return Math.abs(start.y - top.y) < 0.000001 && x > start.x ? { x, y: start.y } : null
	}
	const ratio = (start.y - top.y) / dy
	if (ratio < -0.000001 || ratio > 1.000001) return null
	const x = top.x + ratio * (bottom.x - top.x)
	return x > start.x + 0.000001 ? { x, y: start.y } : null
}

function firstElementToRight(source: ExcalidrawBindableElement, start: { x: number; y: number }, elements: readonly ExcalidrawElement[]) {
	let nearest: { element: ExcalidrawBindableElement; end: { x: number; y: number } } | null = null
	for (const element of elements) {
		if (element.id === source.id || !canConnectElement(element)) continue
		const end = leftEdgeIntersection(element, start)
		if (end && (!nearest || end.x < nearest.end.x)) nearest = { element, end }
	}
	return nearest
}

function horizontalBindingFocus(element: ExcalidrawBindableElement, y: number) {
	// The editor uses this signed distance to keep an off-center arrow bound when a shape moves.
	const vertical = Math.abs(Math.cos(element.angle)) * element.height / 2
	const horizontal = Math.abs(Math.sin(element.angle)) * element.width / 2
	const extent = element.type === 'diamond' ? Math.max(vertical, horizontal) : vertical + horizontal
	return Math.max(-1, Math.min(1, (y - element.y - element.height / 2) / extent))
}

export function connectToRight(api: ExcalidrawImperativeAPI, sourceId: string, click?: { x: number; y: number }) {
	const elements = api.getSceneElementsIncludingDeleted()
	const source = elements.find((element) => element.id === sourceId)
	if (!source || !canConnectElement(source)) return
	const center = { x: source.x + source.width / 2, y: source.y + source.height / 2 }
	const ratio = click ? Math.max(0, Math.min(1, 0.5 +
		(-(click.x - center.x) * Math.sin(source.angle) + (click.y - center.y) * Math.cos(source.angle)) / source.height)) : 0.5
	const start = edgePoint(source, 'right', ratio)
	const hit = firstElementToRight(source, start, elements)
	if (!hit) return
	const { element: target, end } = hit
	if (elements.some((element) => !element.isDeleted && element.type === 'arrow' &&
		element.startBinding?.elementId === source.id && element.endBinding?.elementId === target.id &&
		Math.abs(element.x + element.points[0][0] - start.x) < 1 &&
		Math.abs(element.y + element.points[0][1] - start.y) < 1)) return

	const dx = end.x - start.x
	const [element] = convertToExcalidrawElements([{
		type: 'arrow',
		x: start.x,
		y: start.y,
		points: [[0, 0], [dx, 0]],
		endArrowhead: DEFAULT_ARROWHEAD,
		roughness: SHAPE_ROUGHNESS,
		strokeColor: api.getAppState().currentItemStrokeColor,
	}])
	const arrow = newElementWith(element as ExcalidrawArrowElement, {
		startBinding: { elementId: source.id, focus: horizontalBindingFocus(source, start.y), gap: 1 },
		endBinding: { elementId: target.id, focus: -horizontalBindingFocus(target, end.y), gap: 1 },
	})
	const nextElements = elements.map((element) => element.id === source.id || element.id === target.id
		? newElementWith(element, { boundElements: [...(element.boundElements ?? []), { id: arrow.id, type: 'arrow' }] })
		: element)

	api.updateScene({
		elements: [...nextElements, arrow],
		appState: { selectedElementIds: { [arrow.id]: true }, selectedGroupIds: {} },
		captureUpdate: CaptureUpdateAction.IMMEDIATELY,
	})
}
