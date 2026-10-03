import React from 'react'
import type { BinaryFiles } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import {
	createDefaultDocument,
	getCurrentPage,
	loadDocument,
	saveDocument,
	type StoredAppState,
	type ZoltraakDocument,
	withPageScene,
	withUpdatedAt,
} from '../lib/document'
import { SaveQueue } from '../lib/saveQueue'
import { applyDocumentPatch, createDocumentPatch, isDocumentPatch } from '../lib/documentSync'

const DOCUMENT_SYNC_CHANNEL = 'zoltraak-document-sync'

function createTabId() {
	return globalThis.crypto?.randomUUID?.() ?? `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function useZoltraakDocument(onExternalDocument?: (document: ZoltraakDocument) => void) {
	const [document, setDocument] = React.useState<ZoltraakDocument | null>(null)
	const documentRef = React.useRef<ZoltraakDocument | null>(null)
	const broadcastChannelRef = React.useRef<BroadcastChannel | null>(null)
	const tabIdRef = React.useRef(createTabId())
	const onExternalDocumentRef = React.useRef(onExternalDocument)
	const saveQueueRef = React.useRef<SaveQueue<ZoltraakDocument> | null>(null)
	const saveFailuresRef = React.useRef(0)
	const savedDocumentRef = React.useRef<ZoltraakDocument | undefined>(undefined)
	const broadcastDocumentRef = React.useRef<ZoltraakDocument | undefined>(undefined)
	if (!saveQueueRef.current) {
		saveQueueRef.current = new SaveQueue(async (nextDocument) => {
			setDocument(documentRef.current)
			broadcastChannelRef.current?.postMessage(createDocumentPatch(nextDocument, broadcastDocumentRef.current, tabIdRef.current))
			broadcastDocumentRef.current = nextDocument
			await saveDocument(nextDocument, savedDocumentRef.current)
			savedDocumentRef.current = nextDocument
			saveFailuresRef.current = 0
		}, () => {
			// A single failed batched write must not discard the final drawing.
			if (documentRef.current && saveFailuresRef.current < 3) {
				saveFailuresRef.current += 1
				saveQueueRef.current!.schedule(documentRef.current, 500 * saveFailuresRef.current)
			}
		})
	}
	const sceneVersionsRef = React.useRef(new Map<string, number>())

	React.useEffect(() => {
		onExternalDocumentRef.current = onExternalDocument
	}, [onExternalDocument])

	const persistDocument = React.useCallback((nextDocument: ZoltraakDocument) => {
		const stampedDocument = withUpdatedAt(nextDocument)
		documentRef.current = stampedDocument
		setDocument(stampedDocument)
		return saveQueueRef.current!.enqueue(stampedDocument)
	}, [])

	const resetDocument = React.useCallback(async () => {
		const blankDocument = createDefaultDocument()
		const nextDocument = withUpdatedAt({
			...blankDocument,
			updatedAt: Math.max(blankDocument.updatedAt, documentRef.current?.updatedAt ?? 0),
		})
		documentRef.current = nextDocument
		setDocument(nextDocument)
		sceneVersionsRef.current.clear()
		await saveQueueRef.current!.enqueue(nextDocument)

		return nextDocument
	}, [])

	const updatePageScene = React.useCallback(
		(
			pageId: string,
			elements: readonly ExcalidrawElement[],
			appState: StoredAppState,
			files: BinaryFiles
		) => {
			const currentDocument = documentRef.current
			if (!currentDocument) return
			const page = getCurrentPage(currentDocument)
			const versions = sceneVersionsRef.current
			const sceneChanged = versions.size !== elements.length || elements.some((element) => versions.get(element.id) !== element.version)
			const stateChanged = Object.keys(appState).some((key) => appState[key as keyof StoredAppState] !== page.appState[key as keyof StoredAppState])
			const fileIds = Object.keys(files)
			const filesChanged = fileIds.length !== Object.keys(page.files).length || fileIds.some((id) => files[id] !== page.files[id])
			if (!sceneChanged && !stateChanged && !filesChanged) return
			versions.clear()
			for (const element of elements) versions.set(element.id, element.version)
			const nextDocument = withUpdatedAt(withPageScene(currentDocument, pageId, elements, appState, files))
			documentRef.current = nextDocument
			saveQueueRef.current!.schedule(nextDocument)
		},
		[]
	)

	React.useEffect(() => {
		const flush = () => { void saveQueueRef.current!.flush() }
		const onVisibilityChange = () => { if (globalThis.document.visibilityState === 'hidden') flush() }
		// Flush while the page is still alive, before reload, navigation or backgrounding.
		window.addEventListener('pagehide', flush)
		window.addEventListener('beforeunload', flush)
		globalThis.document.addEventListener('visibilitychange', onVisibilityChange)
		return () => {
			flush()
			window.removeEventListener('pagehide', flush)
			window.removeEventListener('beforeunload', flush)
			globalThis.document.removeEventListener('visibilitychange', onVisibilityChange)
		}
	}, [])

	React.useEffect(() => {
		let isMounted = true

		loadDocument()
			.catch(() => createDefaultDocument())
			.then((loadedDocument) => {
				if (!isMounted) return
				documentRef.current = loadedDocument
				savedDocumentRef.current = loadedDocument
				broadcastDocumentRef.current = loadedDocument
				setDocument(loadedDocument)
			})

		return () => {
			isMounted = false
		}
	}, [])

	React.useEffect(() => {
		if (!('BroadcastChannel' in globalThis)) return

		const channel = new BroadcastChannel(DOCUMENT_SYNC_CHANNEL)
		broadcastChannelRef.current = channel

		channel.onmessage = (event: MessageEvent<unknown>) => {
			if (!isDocumentPatch(event.data)) return
			if (event.data.sourceTabId === tabIdRef.current) return
			const current = documentRef.current
			if (!current) return
			const next = applyDocumentPatch(current, event.data)
			documentRef.current = next
			broadcastDocumentRef.current = next
			saveQueueRef.current!.replacePending(next)
			setDocument(next)
			if (getCurrentPage(current) !== getCurrentPage(next)) onExternalDocumentRef.current?.(next)
		}

		return () => {
			if (broadcastChannelRef.current === channel) {
				broadcastChannelRef.current = null
			}
			channel.close()
		}
	}, [])

	return {
		document,
		documentRef,
		persistDocument,
		resetDocument,
		updatePageScene,
	}
}
