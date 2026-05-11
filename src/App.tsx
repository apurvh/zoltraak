import React from 'react'
import { CaptureUpdateAction, Excalidraw } from '@excalidraw/excalidraw'
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { PageSwitcher } from './components/PageSwitcher'
import { useCanvasShortcuts } from './hooks/useCanvasShortcuts'
import { useZoltraakDocument } from './hooks/useZoltraakDocument'
import {
	createBlankPage,
	getCurrentPage,
	getPageSummaries,
	serializeAppState,
	withPageScene,
	type ZoltraakDocument,
	type ZoltraakPage,
} from './lib/document'
import {
	loadPageIntoApi as loadExcalidrawPage,
	normalizeSceneDefaults,
	pageInitialData,
	sceneFromApi,
} from './lib/excalidrawScene'
import { installTestApi, uninstallTestApi } from './testing/installTestApi'

export function App() {
	const [api, setApi] = React.useState<ExcalidrawImperativeAPI | null>(null)
	const [isPageSwitcherOpen, setIsPageSwitcherOpen] = React.useState(false)
	const apiRef = React.useRef<ExcalidrawImperativeAPI | null>(null)
	const { document, documentRef, persistDocument, resetDocument, updatePageScene } =
		useZoltraakDocument()

	React.useEffect(() => {
		apiRef.current = api
	}, [api])

	const openPageSwitcher = React.useCallback(() => {
		setIsPageSwitcherOpen(true)
	}, [])

	useCanvasShortcuts({
		apiRef,
		onOpenPageSwitcher: openPageSwitcher,
	})

	const loadPageIntoCurrentApi = React.useCallback((page: ZoltraakPage) => {
		const currentApi = apiRef.current
		if (!currentApi) return

		loadExcalidrawPage(currentApi, page)
	}, [])

	const syncCurrentPageFromApi = React.useCallback((sourceDocument: ZoltraakDocument) => {
		const currentApi = apiRef.current
		if (!currentApi) return sourceDocument

		const scene = sceneFromApi(currentApi)

		return withPageScene(
			sourceDocument,
			sourceDocument.currentPageId,
			scene.elements,
			scene.appState,
			scene.files
		)
	}, [])

	React.useEffect(() => {
		installTestApi({
			getApi: () => apiRef.current,
			getDocument: () => documentRef.current,
			resetDocument: async () => {
				const nextDocument = await resetDocument()
				const page = getCurrentPage(nextDocument)
				if (page) {
					loadPageIntoCurrentApi(page)
				}
			},
		})

		return () => {
			uninstallTestApi()
		}
	}, [documentRef, loadPageIntoCurrentApi, resetDocument])

	const closePageSwitcher = React.useCallback(() => {
		setIsPageSwitcherOpen(false)
	}, [])

	const openMermaidToExcalidraw = React.useCallback(() => {
		apiRef.current?.updateScene({
			appState: {
				openDialog: { name: 'ttd', tab: 'mermaid' },
			},
		})
	}, [])

	const handleChange = React.useCallback(
		(
			elements: readonly ExcalidrawElement[],
			appState: AppState,
			files: BinaryFiles
		) => {
			const currentDocument = documentRef.current
			if (!currentDocument) return

			const normalizedScene = normalizeSceneDefaults(elements)

			updatePageScene(
				currentDocument.currentPageId,
				normalizedScene.elements,
				serializeAppState(appState),
				files
			)

			if (normalizedScene.changed && !appState.newElement) {
				apiRef.current?.updateScene({
					elements: normalizedScene.elements,
					captureUpdate: CaptureUpdateAction.NEVER,
				})
			}
		},
		[documentRef, updatePageScene]
	)

	const switchPage = React.useCallback(
		(pageId: string) => {
			const currentDocument = documentRef.current
			if (!currentDocument || currentDocument.currentPageId === pageId) return

			const syncedDocument = syncCurrentPageFromApi(currentDocument)
			const targetPage = syncedDocument.pages.find((page) => page.id === pageId)
			if (!targetPage) return

			const nextDocument = {
				...syncedDocument,
				currentPageId: pageId,
			}

			persistDocument(nextDocument)
			loadPageIntoCurrentApi(targetPage)
		},
		[documentRef, loadPageIntoCurrentApi, persistDocument, syncCurrentPageFromApi]
	)

	const createPage = React.useCallback(
		(name: string) => {
			const currentDocument = documentRef.current
			if (!currentDocument) return

			const syncedDocument = syncCurrentPageFromApi(currentDocument)
			const page = createBlankPage(name)
			const nextDocument = {
				...syncedDocument,
				currentPageId: page.id,
				pages: [...syncedDocument.pages, page],
			}

			persistDocument(nextDocument)
			loadPageIntoCurrentApi(page)
		},
		[documentRef, loadPageIntoCurrentApi, persistDocument, syncCurrentPageFromApi]
	)

	if (!document) {
		return <main className="app-shell" />
	}

	const currentPage = getCurrentPage(document)

	return (
		<main className="app-shell">
			<Excalidraw
				excalidrawAPI={setApi}
				initialData={pageInitialData(currentPage)}
				onChange={handleChange}
			/>
			<PageSwitcher
				currentPageId={document.currentPageId}
				isOpen={isPageSwitcherOpen}
				onClose={closePageSwitcher}
				onCreatePage={createPage}
				onOpenMermaidToExcalidraw={openMermaidToExcalidraw}
				onSwitchPage={switchPage}
				pages={getPageSummaries(document)}
			/>
		</main>
	)
}
