import React from 'react'
import { CaptureUpdateAction, convertToExcalidrawElements, Excalidraw, newElementWith } from '@excalidraw/excalidraw'
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI, PointerDownState } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement, ExcalidrawImageElement } from '@excalidraw/excalidraw/element/types'
import { MermaidEditor, type MermaidSubmitResult } from './components/MermaidEditor'
import { PageSwitcher } from './components/PageSwitcher'
import { useCanvasShortcuts } from './hooks/useCanvasShortcuts'
import { useMermaidDoubleClick } from './hooks/useMermaidDoubleClick'
import { useZoltraakDocument } from './hooks/useZoltraakDocument'
import { getDefaultImageFileId, type DefaultImage } from './lib/defaultImages'
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

function createId() {
	return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function App() {
	const [api, setApi] = React.useState<ExcalidrawImperativeAPI | null>(null)
	const [isPageSwitcherOpen, setIsPageSwitcherOpen] = React.useState(false)
	const [isMermaidEditorOpen, setIsMermaidEditorOpen] = React.useState(false)
	const [mermaidEditingElementId, setMermaidEditingElementId] = React.useState<string | null>(null)
	const [mermaidEditingSource, setMermaidEditingSource] = React.useState('')
	const apiRef = React.useRef<ExcalidrawImperativeAPI | null>(null)
	const lastPointerScenePositionRef = React.useRef<{ x: number; y: number } | null>(null)
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

	const openMermaidEditor = React.useCallback(() => {
		setMermaidEditingElementId(null)
		setMermaidEditingSource('')
		setIsMermaidEditorOpen(true)
	}, [])

	const closeMermaidEditor = React.useCallback(() => {
		setIsMermaidEditorOpen(false)
	}, [])

	const handlePointerUpdate = React.useCallback(
		({ pointer }: { pointer: { x: number; y: number } }) => {
			lastPointerScenePositionRef.current = { x: pointer.x, y: pointer.y }
		},
		[]
	)

	const handlePointerUp = React.useCallback(
		(activeTool: AppState['activeTool'], pointerDownState: PointerDownState) => {
			if (activeTool.type !== 'selection') return

			const currentApi = apiRef.current
			if (!currentApi) return

			// Fast-path: if the drag touched any existing element, it's a selection, not a draw.
			if (pointerDownState.hit.allHitElements.length > 0) return

			const startX = pointerDownState.origin.x
			const startY = pointerDownState.origin.y
			const endPosition = lastPointerScenePositionRef.current ?? pointerDownState.lastCoords
			const endX = endPosition.x
			const endY = endPosition.y

			const width = Math.abs(endX - startX)
			const height = Math.abs(endY - startY)
			const hasSelectionDrag =
				pointerDownState.drag.hasOccurred ||
				pointerDownState.boxSelection.hasOccurred ||
				width >= 15 ||
				height >= 15
			if (!hasSelectionDrag) return

			// Ignore tiny drags that are likely accidental
			if (width < 15 && height < 15) return

			const isHorizontalArrow = height < 15 || width > height * 3
			const isVerticalArrow = width < 15 || height > width * 3

			let isArrow = false
			let isHorizontal = false

			if (isHorizontalArrow && !isVerticalArrow) {
				isArrow = true
				isHorizontal = true
			} else if (isVerticalArrow && !isHorizontalArrow) {
				isArrow = true
				isHorizontal = false
			} else if (isHorizontalArrow && isVerticalArrow) {
				isArrow = true
				isHorizontal = width > height
			} else {
				isArrow = false
			}

			// Defer by one task so Excalidraw can settle its selection state after pointer-up
			setTimeout(() => {
				const settledAppState = currentApi.getAppState()
				// Double-check: if something got selected (e.g. via box selection), bail out
				if (Object.keys(settledAppState.selectedElementIds).length > 0) return

				let newElement
				if (isArrow) {
					newElement = {
						type: 'arrow' as const,
						x: startX,
						y: startY,
						points: [[0, 0], isHorizontal ? [endX - startX, 0] : [0, endY - startY]],
						roughness: settledAppState.currentItemRoughness,
						strokeColor: settledAppState.currentItemStrokeColor,
					}
				} else {
					newElement = {
						type: 'rectangle' as const,
						x: Math.min(startX, endX),
						y: Math.min(startY, endY),
						width,
						height,
						roughness: settledAppState.currentItemRoughness,
						strokeColor: settledAppState.currentItemStrokeColor,
					}
				}

				const [excalidrawElement] = convertToExcalidrawElements([newElement])
				const elements = currentApi.getSceneElements()
				currentApi.updateScene({
					elements: [...elements, excalidrawElement],
					captureUpdate: CaptureUpdateAction.IMMEDIATELY,
				})
			}, 0)
		},
		[]
	)

	const getImageInsertionPosition = React.useCallback(
		(appState: AppState, width: number, height: number) => {
			const pointer = lastPointerScenePositionRef.current
			const centerX =
				pointer?.x ?? (-appState.scrollX + appState.width / 2) / appState.zoom.value
			const centerY =
				pointer?.y ?? (-appState.scrollY + appState.height / 2) / appState.zoom.value

			return {
				x: centerX - width / 2,
				y: centerY - height / 2,
			}
		},
		[]
	)

	const handleInsertDefaultImage = React.useCallback(
		(image: DefaultImage) => {
			const currentApi = apiRef.current
			if (!currentApi) return

			const fileId = getDefaultImageFileId(image)
			const now = Date.now()

			currentApi.addFiles([
				{
					id: fileId as any,
					dataURL: image.dataUrl as any,
					mimeType: image.mimeType,
					created: now,
					lastRetrieved: now,
				},
			])

			const appState = currentApi.getAppState()
			const position = getImageInsertionPosition(appState, image.width, image.height)
			const [imageElement] = convertToExcalidrawElements([
				{
					type: 'image' as const,
					id: createId(),
					x: position.x,
					y: position.y,
					width: image.width,
					height: image.height,
					fileId: fileId as any,
					status: 'saved' as const,
					customData: { defaultImageId: image.id },
				},
			])

			const elements = currentApi.getSceneElements()
			currentApi.updateScene({
				elements: [...elements, imageElement],
				captureUpdate: CaptureUpdateAction.IMMEDIATELY,
			})
		},
		[getImageInsertionPosition]
	)

	const handleMermaidSubmit = React.useCallback(
		(result: MermaidSubmitResult) => {
			const currentApi = apiRef.current
			if (!currentApi) return

			const fileId = createId()

			currentApi.addFiles([
				{
					id: fileId as any,
					dataURL: result.dataUrl as any,
					mimeType: 'image/svg+xml',
					created: Date.now(),
					lastRetrieved: Date.now(),
				},
			])

			if (result.elementId) {
				// Edit mode: update existing element
				const elements = currentApi.getSceneElements()
				const updatedElements = elements.map((el) => {
					if (el.id !== result.elementId) return el

					return newElementWith(el as ExcalidrawImageElement, {
						fileId: fileId as any,
						width: result.width,
						height: result.height,
						customData: { mermaidSource: result.source },
					})
				})

				currentApi.updateScene({
					elements: updatedElements,
					captureUpdate: CaptureUpdateAction.IMMEDIATELY,
				})
			} else {
				// Create mode: insert new image element at viewport center
				const appState = currentApi.getAppState()
				const centerX = (-appState.scrollX + appState.width / 2) / appState.zoom.value - result.width / 2
				const centerY = (-appState.scrollY + appState.height / 2) / appState.zoom.value - result.height / 2

				const [imageElement] = convertToExcalidrawElements([
					{
						type: 'image' as const,
						id: createId(),
						x: centerX,
						y: centerY,
						width: result.width,
						height: result.height,
						fileId: fileId as any,
						status: 'saved' as const,
						customData: { mermaidSource: result.source },
					},
				])

				const elements = currentApi.getSceneElements()
				currentApi.updateScene({
					elements: [...elements, imageElement],
					captureUpdate: CaptureUpdateAction.IMMEDIATELY,
				})
			}

			setIsMermaidEditorOpen(false)
		},
		[]
	)

	const handleEditMermaid = React.useCallback((elementId: string, source: string) => {
		setMermaidEditingElementId(elementId)
		setMermaidEditingSource(source)
		setIsMermaidEditorOpen(true)
	}, [])

	useMermaidDoubleClick({
		apiRef,
		onEditMermaid: handleEditMermaid,
	})

	const handleChange = React.useCallback(
		(
			elements: readonly ExcalidrawElement[],
			appState: AppState,
			files: BinaryFiles
		) => {
			const currentDocument = documentRef.current
			if (!currentDocument) return

			const normalizedScene = normalizeSceneDefaults(elements, appState.editingTextElement?.id)

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
				onPointerUpdate={handlePointerUpdate}
				onPointerUp={handlePointerUp}
			/>
			<PageSwitcher
				currentPageId={document.currentPageId}
				isOpen={isPageSwitcherOpen}
				onClose={closePageSwitcher}
				onCreatePage={createPage}
				onInsertDefaultImage={handleInsertDefaultImage}
				onOpenMermaidToExcalidraw={openMermaidEditor}
				onSwitchPage={switchPage}
				pages={getPageSummaries(document)}
			/>
			<MermaidEditor
				editingElementId={mermaidEditingElementId}
				initialSource={mermaidEditingSource}
				isOpen={isMermaidEditorOpen}
				theme={currentPage?.appState?.theme || 'light'}
				onClose={closeMermaidEditor}
				onSubmit={handleMermaidSubmit}
			/>
		</main>
	)
}
