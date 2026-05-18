import { CaptureUpdateAction, ROUNDNESS, newElementWith } from '@excalidraw/excalidraw'
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

let _measureCanvas: HTMLCanvasElement | null = null

// Mirror Excalidraw's getFontFamilyString logic (chunk-4FTI6OG3.js:1129-1138)
// fontFamily values: 1=Virgil, 2=Helvetica, 3=Cascadia, 5=Excalifont(default), 6=Nunito, 7=Lilita One, 8=Comic Shanns, 9=Liberation Sans
const EXCALIDRAW_FONT_FAMILY_STRINGS: Record<number, string> = {
	1: 'Virgil, Segoe UI Emoji',
	2: 'Helvetica, Segoe UI Emoji',
	3: 'Cascadia, Segoe UI Emoji',
	5: 'Excalifont, Xiaolai, Segoe UI Emoji',
	6: 'Nunito, Segoe UI Emoji',
	7: 'Lilita One, Segoe UI Emoji',
	8: 'Comic Shanns, Segoe UI Emoji',
	9: 'Liberation Sans, Segoe UI Emoji',
}

function measureTextWidth(text: string, fontSize: number, fontFamily: number): number {
	if (!_measureCanvas) {
		_measureCanvas = document.createElement('canvas')
	}
	const ctx = _measureCanvas.getContext('2d')
	if (!ctx) return 0
	const familyString = EXCALIDRAW_FONT_FAMILY_STRINGS[fontFamily] ?? 'Excalifont, Xiaolai, Segoe UI Emoji'
	ctx.font = `${fontSize}px ${familyString}`
	return ctx.measureText(text).width
}

export function normalizeSceneDefaults(
	elements: readonly ExcalidrawElement[],
	editingTextElementId?: string | null
) {
	let changed = false
	const normalizedElements = elements.map((element) => {
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

		if (element.type === 'text') {
			const el = element as ExcalidrawTextElement

			// Don't transform while the user is actively typing in this element
			if (editingTextElementId === el.id) return element

			// Use originalText as source of truth — text may be wrapped inside containers
			const sourceText = el.originalText ?? el.text
			const hasAgent = /agent/i.test(sourceText)
			const hasPrefix = sourceText.startsWith('* ')

			if (hasAgent && !hasPrefix) {
				changed = true
				const newOriginalText = `* ${sourceText}`
				if (el.containerId !== null) {
					// Bound text: set originalText and text to unwrapped prefixed string;
					// Excalidraw will re-wrap on next layout pass
					return newElementWith(el, {
						text: newOriginalText,
						originalText: newOriginalText,
					})
				}
				const newText = `* ${el.text}`
				const newWidth = Math.max(el.width, measureTextWidth(newText, el.fontSize, el.fontFamily))
				return newElementWith(el, {
					text: newText,
					originalText: newOriginalText,
					width: newWidth,
				})
			}

			if (!hasAgent && hasPrefix) {
				changed = true
				const newOriginalText = sourceText.slice(2)
				if (el.containerId !== null) {
					// Bound text: set originalText and text to unwrapped stripped string
					return newElementWith(el, {
						text: newOriginalText,
						originalText: newOriginalText,
					})
				}
				const newText = el.text.startsWith('* ') ? el.text.slice(2) : el.text
				const newWidth = measureTextWidth(newText, el.fontSize, el.fontFamily)
				return newElementWith(el, {
					text: newText,
					originalText: newOriginalText,
					width: newWidth,
				})
			}

			return element
		}

		return element
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
