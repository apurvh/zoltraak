import { CaptureUpdateAction, convertToExcalidrawElements, mutateElement, newElementWith } from '@excalidraw/excalidraw'
import type { ExcalidrawImageElement } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { defaultImages } from './defaultImages'

const defaultImageNames: Readonly<Record<string, string>> = {
	cache: 'Cache',
	database: 'Database',
	queue: 'Queue',
}

export function hasDefaultImageName(imageId: string) {
	return !!defaultImageNames[imageId]
}

export function withDefaultImageLabel(image: ExcalidrawImageElement) {
	const name = defaultImageNames[image.customData?.defaultImageId]
	if (!name) return [image]
	// Cache and Database have more empty space below their SVG artwork than Queue.
	const labelBottom = name === 'Queue' ? 1 : 0.89
	const groupId = globalThis.crypto.randomUUID()
	const [label] = convertToExcalidrawElements([{
		type: 'text',
		x: 0,
		y: image.y + image.height * labelBottom + 8,
		text: name,
		fontSize: 20,
		fontFamily: 2,
		textAlign: 'center',
		strokeColor: '#1f2937',
		groupIds: [groupId],
		customData: { defaultImageLabelFor: image.id },
	}])
	return [
		newElementWith(image, {
			groupIds: [groupId],
			customData: { ...image.customData, needsDefaultLabel: false },
		}),
		newElementWith(label, { x: image.x + (image.width - label.width) / 2 }),
	]
}

export function finishDefaultImagePlacement(api: ExcalidrawImperativeAPI) {
	const state = api.getAppState()
	const image = state.newElement
	if (image?.type !== 'image' || !image.customData?.needsDefaultLabel) return
	// Match native click placement before its final history entry is captured.
	if (image.width < 3 / state.zoom.value && image.height < 3 / state.zoom.value) {
		const asset = defaultImages.find((asset) => asset.id === image!.customData?.defaultImageId)!
		const maxHeight = Math.min(Math.max(state.height - 120, 160), Math.floor(state.height * 0.5) / state.zoom.value)
		const height = Math.min(asset.height, maxHeight)
		const width = height * asset.width / asset.height
		mutateElement(image, {
			x: image.x + image.width / 2 - width / 2,
			y: image.y + image.height / 2 - height / 2,
			width, height,
		}, false)
	}
	const [groupedImage, label] = withDefaultImageLabel(image)
	const elements = api.getSceneElementsIncludingDeleted()
	// The pending preview is not a saved drawing. Exclude it from the undo baseline.
	api.updateScene({
		elements: elements.filter((element) => element.id !== image.id),
		captureUpdate: CaptureUpdateAction.NEVER,
	})
	// Keep the object referenced by native image finalization in sync with the scene.
	mutateElement(image, { groupIds: groupedImage.groupIds, customData: groupedImage.customData }, false)
	api.updateScene({
		elements: [...elements, label],
		captureUpdate: CaptureUpdateAction.EVENTUALLY,
	})
	// Native image finalization selects the image; select its label too once it settles.
	setTimeout(() => {
		const settled = api.getAppState()
		if (settled.activeTool.type !== 'selection' || !settled.selectedElementIds[image.id]) return
		api.updateScene({
			appState: {
				selectedElementIds: { [image.id]: true, [label.id]: true },
				selectedGroupIds: { [groupedImage.groupIds[0]]: true },
			},
			captureUpdate: CaptureUpdateAction.EVENTUALLY,
		})
	}, 0)
}
