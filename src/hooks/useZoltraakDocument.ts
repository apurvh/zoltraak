import React from 'react'
import type { BinaryFiles } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import {
	createDefaultDocument,
	loadDocument,
	saveDocument,
	type StoredAppState,
	type ZoltraakDocument,
	withPageScene,
	withUpdatedAt,
} from '../lib/document'
import { SaveQueue } from '../lib/saveQueue'

const DOCUMENT_SYNC_CHANNEL = 'zoltraak-document-sync'

type DocumentSyncMessage = {
	sourceTabId: string
	document: ZoltraakDocument
}

function createTabId() {
	return globalThis.crypto?.randomUUID?.() ?? `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isDocumentSyncMessage(value: unknown): value is DocumentSyncMessage {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as DocumentSyncMessage).sourceTabId === 'string' &&
		typeof (value as DocumentSyncMessage).document === 'object' &&
		(value as DocumentSyncMessage).document !== null &&
		typeof (value as DocumentSyncMessage).document.updatedAt === 'number'
	)
}

export function useZoltraakDocument(onExternalDocument?: (document: ZoltraakDocument) => void) {
	const [document, setDocument] = React.useState<ZoltraakDocument | null>(null)
	const documentRef = React.useRef<ZoltraakDocument | null>(null)
	const saveQueueRef = React.useRef(new SaveQueue(saveDocument))
	const broadcastChannelRef = React.useRef<BroadcastChannel | null>(null)
	const tabIdRef = React.useRef(createTabId())
	const onExternalDocumentRef = React.useRef(onExternalDocument)

	React.useEffect(() => {
		onExternalDocumentRef.current = onExternalDocument
	}, [onExternalDocument])

	const broadcastDocument = React.useCallback((nextDocument: ZoltraakDocument) => {
		broadcastChannelRef.current?.postMessage({
			sourceTabId: tabIdRef.current,
			document: nextDocument,
		} satisfies DocumentSyncMessage)
	}, [])

	const persistDocument = React.useCallback((nextDocument: ZoltraakDocument) => {
		const stampedDocument = withUpdatedAt(nextDocument)
		documentRef.current = stampedDocument
		setDocument(stampedDocument)
		broadcastDocument(stampedDocument)
		return saveQueueRef.current.enqueue(stampedDocument)
	}, [broadcastDocument])

	const resetDocument = React.useCallback(async () => {
		const blankDocument = createDefaultDocument()
		const nextDocument = withUpdatedAt({
			...blankDocument,
			updatedAt: Math.max(blankDocument.updatedAt, documentRef.current?.updatedAt ?? 0),
		})
		documentRef.current = nextDocument
		setDocument(nextDocument)
		broadcastDocument(nextDocument)
		await saveQueueRef.current.enqueue(nextDocument)

		return nextDocument
	}, [broadcastDocument])

	const updatePageScene = React.useCallback(
		(
			pageId: string,
			elements: readonly ExcalidrawElement[],
			appState: StoredAppState,
			files: BinaryFiles
		) => {
			const currentDocument = documentRef.current
			if (!currentDocument) return

			persistDocument(withPageScene(currentDocument, pageId, elements, appState, files))
		},
		[persistDocument]
	)

	React.useEffect(() => {
		let isMounted = true

		loadDocument()
			.catch(() => createDefaultDocument())
			.then((loadedDocument) => {
				if (!isMounted) return
				documentRef.current = loadedDocument
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
			if (!isDocumentSyncMessage(event.data)) return
			if (event.data.sourceTabId === tabIdRef.current) return
			if ((documentRef.current?.updatedAt ?? 0) >= event.data.document.updatedAt) return

			documentRef.current = event.data.document
			setDocument(event.data.document)
			onExternalDocumentRef.current?.(event.data.document)
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
