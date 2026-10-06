import { CaptureUpdateAction, ROUNDNESS, convertToExcalidrawElements, restoreElements, newElementWith } from '@excalidraw/excalidraw'
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement, ExcalidrawTextElement } from '@excalidraw/excalidraw/element/types'
import { serializeAppState, type ZoltraakPage } from './document'

export const SHAPE_ROUGHNESS = 0.5
export const RECTANGLE_CORNER_RADIUS = 6.4
export const DEFAULT_ARROWHEAD = 'triangle_outline'

const subtleRectangleRoundness = {
	type: ROUNDNESS.ADAPTIVE_RADIUS,
	value: RECTANGLE_CORNER_RADIUS,
} as const

export function pageInitialData(page: ZoltraakPage) {
	return {
		elements: page.elements,
		appState: page.appState,
		files: page.files,
		scrollToContent: false,
	}
}

function pageUpdateAppState(page: ZoltraakPage, appState: AppState) {
	return {
		...page.appState,
		selectedElementIds: {},
		pendingImageElementId: null,
		...(appState.pendingImageElementId
			? { activeTool: { type: 'selection', customType: null, locked: false, lastActiveTool: null } }
			: {}),
	} as Parameters<ExcalidrawImperativeAPI['updateScene']>[0]['appState']
}

export function sceneFromApi(api: ExcalidrawImperativeAPI) {
	const appState = api.getAppState()
	return {
		elements: api.getSceneElements().filter((element) => element.id !== appState.pendingImageElementId),
		appState: serializeAppState(appState),
		files: api.getFiles(),
	}
}

export function loadPageIntoApi(api: ExcalidrawImperativeAPI, page: ZoltraakPage) {
	const appState = api.getAppState()
	api.addFiles(Object.values(page.files))
	api.updateScene({
		elements: page.elements,
		appState: pageUpdateAppState(page, appState),
		captureUpdate: CaptureUpdateAction.NEVER,
	})
	api.history.clear()
}

// Text decoration must use the same wrapping and geometry as the canvas/editor.
type TextLayoutCache = WeakMap<ExcalidrawElement, { version: number; containerVersion?: number }>

function normalizeAgentText(elements: readonly ExcalidrawElement[], editingTextElementId?: string | null, cache?: TextLayoutCache) {
	const updates = new Map<string, ExcalidrawElement>()
	const elementsById = new Map(elements.map((element) => [element.id, element]))
	for (const element of elements) {
		if (element.type !== 'text' || element.isDeleted || element.id === editingTextElementId) continue
		const source = element.originalText ?? element.text
		const hasPrefix = source.startsWith('✨ ')
		const hasAgent = /agent/i.test(source)
		if (!hasAgent && !hasPrefix) continue
		const text = hasAgent ? (hasPrefix ? source : `✨ ${source}`) : source.slice(2)
		const candidate = element.containerId ? elementsById.get(element.containerId) : undefined
		const container = candidate?.isDeleted ? undefined : candidate
		const cached = cache?.get(element)
		if (cached?.version === element.version && cached.containerVersion === container?.version) continue
		if (container && (container.type === 'rectangle' || container.type === 'ellipse' || container.type === 'diamond' || container.type === 'arrow')) {
			const label = { ...element, text, originalText: text }
			const [laidOutContainer, laidOutText] = convertToExcalidrawElements([{
				...container,
				boundElements: container.boundElements?.filter((bound) => bound.id !== element.id),
				label,
			}], { regenerateIds: false })
			if (container.width !== laidOutContainer.width || container.height !== laidOutContainer.height) updates.set(container.id, newElementWith(container, {
				x: laidOutContainer.x, y: laidOutContainer.y,
				width: laidOutContainer.width, height: laidOutContainer.height,
			}))
			if (element.text !== (laidOutText as ExcalidrawTextElement).text || element.originalText !== text ||
				element.x !== laidOutText.x || element.y !== laidOutText.y || element.width !== laidOutText.width || element.height !== laidOutText.height) updates.set(element.id, newElementWith(element, {
				text: (laidOutText as ExcalidrawTextElement).text, originalText: text,
				x: laidOutText.x, y: laidOutText.y, width: laidOutText.width, height: laidOutText.height,
			}))
		} else {
			const [laidOutText] = restoreElements([{ ...element, text, originalText: text }], null,
				{ repairBindings: true, refreshDimensions: true })
			if (element.text !== (laidOutText as ExcalidrawTextElement).text || element.originalText !== text ||
				element.width !== laidOutText.width || element.height !== laidOutText.height) updates.set(element.id, newElementWith(element, {
				text: (laidOutText as ExcalidrawTextElement).text, originalText: text,
				width: laidOutText.width, height: laidOutText.height,
			}))
		}
		if (!updates.has(element.id) && (!container || !updates.has(container.id))) {
			cache?.set(element, { version: element.version, containerVersion: container?.version })
		}
	}
	return updates.size ? elements.map((element) => updates.get(element.id) ?? element) : elements
}

export function normalizeSceneDefaults(
	elements: readonly ExcalidrawElement[],
	editingTextElementId?: string | null
) {
	const decoratedElements = normalizeAgentText(elements, editingTextElementId)
	let changed = decoratedElements !== elements
	const normalizedElements = decoratedElements.map((element) => {
		if (element.type === 'rectangle') {
			if (
				element.roughness === SHAPE_ROUGHNESS &&
				element.roundness?.type === subtleRectangleRoundness.type &&
				element.roundness.value === subtleRectangleRoundness.value
			) {
				return element
			}

			changed = true
			return newElementWith(element, {
				roughness: SHAPE_ROUGHNESS,
				roundness: subtleRectangleRoundness,
			})
		}

		if (element.type === 'arrow') {
			if (element.roughness === SHAPE_ROUGHNESS && element.endArrowhead === DEFAULT_ARROWHEAD) {
				return element
			}

			changed = true
			return newElementWith(element, {
				endArrowhead: DEFAULT_ARROWHEAD,
				roughness: SHAPE_ROUGHNESS,
			})
		}

		return element
	})

	return {
		changed,
		elements: normalizedElements,
	}
}

export function createSceneNormalizer() {
	// Excalidraw can mutate an element in place, so check its version as well as identity.
	const cache = new WeakMap<ExcalidrawElement, { version: number; editing: boolean; normalized: ExcalidrawElement; normalizedVersion: number }>()
	const textLayoutCache: TextLayoutCache = new WeakMap()
	return (elements: readonly ExcalidrawElement[], editingTextElementId?: string | null) => {
		const decoratedElements = normalizeAgentText(elements, editingTextElementId, textLayoutCache)
		let changed = decoratedElements !== elements
		const normalizedElements = decoratedElements.map((element) => {
			const editing = element.id === editingTextElementId
			const cached = cache.get(element)
			let normalized: ExcalidrawElement
			if (cached && cached.version === element.version && cached.editing === editing && cached.normalized.version === cached.normalizedVersion) {
				normalized = cached.normalized
			} else {
				normalized = element.type === 'text' ? element : normalizeSceneDefaults([element], editingTextElementId).elements[0]
				cache.set(element, { version: element.version, editing, normalized, normalizedVersion: normalized.version })
			}
			if (normalized !== element) changed = true
			return normalized
		})
		return { changed, elements: changed ? normalizedElements : elements }
	}
}

export type SceneChange = {
	elements: readonly ExcalidrawElement[]
	appState: AppState
	files: BinaryFiles
}
