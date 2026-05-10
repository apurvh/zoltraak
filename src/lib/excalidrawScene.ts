import { CaptureUpdateAction } from '@excalidraw/excalidraw'
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { serializeAppState, type ZoltraakPage } from './document'

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

export type SceneChange = {
	elements: readonly ExcalidrawElement[]
	appState: AppState
	files: BinaryFiles
}
