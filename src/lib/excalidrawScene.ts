import { CaptureUpdateAction, ROUNDNESS, newElementWith } from '@excalidraw/excalidraw'
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { serializeAppState, type ZoltraakPage } from './document'

export const RECTANGLE_CORNER_RADIUS = 6.4

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

function pageUpdateAppState(page: ZoltraakPage) {
	return {
		...page.appState,
		selectedElementIds: {},
	} as Parameters<ExcalidrawImperativeAPI['updateScene']>[0]['appState']
}

export function sceneFromApi(api: ExcalidrawImperativeAPI) {
	return {
		elements: api.getSceneElements(),
		appState: serializeAppState(api.getAppState()),
		files: api.getFiles(),
	}
}

export function loadPageIntoApi(api: ExcalidrawImperativeAPI, page: ZoltraakPage) {
	api.addFiles(Object.values(page.files))
	api.updateScene({
		elements: page.elements,
		appState: pageUpdateAppState(page),
		captureUpdate: CaptureUpdateAction.NEVER,
	})
	api.history.clear()
}

export function normalizeRectangleDefaults(elements: readonly ExcalidrawElement[]) {
	let changed = false
	const normalizedElements = elements.map((element) => {
		if (
			element.type !== 'rectangle' ||
			(element.roughness === 0 &&
				element.roundness?.type === subtleRectangleRoundness.type &&
				element.roundness.value === subtleRectangleRoundness.value)
		) {
			return element
		}

		changed = true
		return newElementWith(element, {
			roughness: 0,
			roundness: subtleRectangleRoundness,
		})
	})

	return {
		changed,
		elements: normalizedElements,
	}
}

export type SceneChange = {
	elements: readonly ExcalidrawElement[]
	appState: AppState
	files: BinaryFiles
}
