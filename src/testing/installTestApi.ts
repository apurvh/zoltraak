import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { getPageSummaries, type ZoltraakDocument } from '../lib/document'

type TestApiOptions = {
	getApi: () => ExcalidrawImperativeAPI | null
	getDocument: () => ZoltraakDocument | null
	resetDocument: () => Promise<void>
}

declare global {
	interface Window {
		__zoltraakTestApi?: {
			getCurrentToolId: () => string
			getShapes: () => Array<{ id: string; type: string; props: Record<string, unknown> }>
			getSelectedShapeIds: () => string[]
			getCurrentPageId: () => string
			getPages: () => Array<{ id: string; name: string }>
			resetDocument: () => Promise<void>
		}
	}
}

export function installTestApi({ getApi, getDocument, resetDocument }: TestApiOptions) {
	if (!import.meta.env.DEV) return

	window.__zoltraakTestApi = {
		getCurrentToolId: () => getApi()?.getAppState().activeTool.type ?? '',
		getShapes: () =>
			(getApi()?.getSceneElements() ?? []).map((element) => ({
				id: element.id,
				type: element.type,
				props: { ...element },
			})),
		getSelectedShapeIds: () => Object.keys(getApi()?.getAppState().selectedElementIds ?? {}),
		getCurrentPageId: () => getDocument()?.currentPageId ?? '',
		getPages: () => {
			const document = getDocument()

			return document ? getPageSummaries(document) : []
		},
		resetDocument,
	}
}

export function uninstallTestApi() {
	delete window.__zoltraakTestApi
}
