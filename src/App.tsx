import React from 'react'
import { CaptureUpdateAction, Excalidraw } from '@excalidraw/excalidraw'
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { PageSwitcher } from './components/PageSwitcher'
import {
	createBlankPage,
	getCurrentPage,
	getPageSummaries,
	loadDocument,
	resetStoredDocument,
	saveDocument,
	serializeAppState,
	withPageScene,
	type ZoltraakDocument,
	type ZoltraakPage,
} from './lib/document'
import { installTestApi, uninstallTestApi } from './testing/installTestApi'

function isTextInputTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false

	return (
		target.isContentEditable ||
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement
	)
}

function pageInitialData(page: ZoltraakPage) {
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

function sceneFromApi(api: ExcalidrawImperativeAPI) {
	return {
		elements: api.getSceneElements(),
		appState: serializeAppState(api.getAppState()),
		files: api.getFiles(),
	}
}

export function App() {
	const [document, setDocument] = React.useState<ZoltraakDocument | null>(null)
	const [api, setApi] = React.useState<ExcalidrawImperativeAPI | null>(null)
	const [isPageSwitcherOpen, setIsPageSwitcherOpen] = React.useState(false)
	const documentRef = React.useRef<ZoltraakDocument | null>(null)
	const apiRef = React.useRef<ExcalidrawImperativeAPI | null>(null)
	const saveChainRef = React.useRef<Promise<void>>(Promise.resolve())

	const persistDocument = React.useCallback((nextDocument: ZoltraakDocument) => {
		documentRef.current = nextDocument
		setDocument(nextDocument)
		saveChainRef.current = saveChainRef.current.then(() => saveDocument(nextDocument))
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

	const loadPageIntoApi = React.useCallback((page: ZoltraakPage) => {
		const currentApi = apiRef.current
		if (!currentApi) return

		currentApi.addFiles(Object.values(page.files))
		currentApi.updateScene({
			elements: page.elements,
			appState: pageUpdateAppState(page),
			captureUpdate: CaptureUpdateAction.NEVER,
		})
		currentApi.history.clear()
	}, [])

	React.useEffect(() => {
		let isMounted = true

		loadDocument().then((loadedDocument) => {
			if (!isMounted) return
			documentRef.current = loadedDocument
			setDocument(loadedDocument)
		})

		return () => {
			isMounted = false
		}
	}, [])

	React.useEffect(() => {
		apiRef.current = api
	}, [api])

	React.useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (isTextInputTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return

			if (event.key === 'r') {
				event.preventDefault()
				apiRef.current?.setActiveTool({ type: 'rectangle' })
				return
			}

			if (event.key === 'a') {
				event.preventDefault()
				apiRef.current?.setActiveTool({ type: 'arrow' })
			}
		}

		window.addEventListener('keydown', handleKeyDown)

		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [])

	React.useEffect(() => {
		function handlePageSwitcherShortcut(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault()
				setIsPageSwitcherOpen(true)
			}
		}

		window.addEventListener('keydown', handlePageSwitcherShortcut)

		return () => window.removeEventListener('keydown', handlePageSwitcherShortcut)
	}, [])

	React.useEffect(() => {
		installTestApi({
			getApi: () => apiRef.current,
			getDocument: () => documentRef.current,
			resetDocument: async () => {
				const nextDocument = await resetStoredDocument()
				documentRef.current = nextDocument
				setDocument(nextDocument)

				const page = getCurrentPage(nextDocument)
				if (page) {
					loadPageIntoApi(page)
				}
			},
		})

		return () => {
			uninstallTestApi()
		}
	}, [loadPageIntoApi])

	const closePageSwitcher = React.useCallback(() => {
		setIsPageSwitcherOpen(false)
	}, [])

	const handleChange = React.useCallback(
		(
			elements: readonly ExcalidrawElement[],
			appState: AppState,
			files: BinaryFiles
		) => {
			const currentDocument = documentRef.current
			if (!currentDocument) return

			persistDocument(
				withPageScene(
					currentDocument,
					currentDocument.currentPageId,
					elements,
					serializeAppState(appState),
					files
				)
			)
		},
		[persistDocument]
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
			loadPageIntoApi(targetPage)
		},
		[loadPageIntoApi, persistDocument, syncCurrentPageFromApi]
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
			loadPageIntoApi(page)
		},
		[loadPageIntoApi, persistDocument, syncCurrentPageFromApi]
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
				onSwitchPage={switchPage}
				pages={getPageSummaries(document)}
			/>
		</main>
	)
}
