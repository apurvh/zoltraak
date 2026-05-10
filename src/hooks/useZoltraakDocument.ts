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
} from '../lib/document'
import { SaveQueue } from '../lib/saveQueue'

export function useZoltraakDocument() {
	const [document, setDocument] = React.useState<ZoltraakDocument | null>(null)
	const documentRef = React.useRef<ZoltraakDocument | null>(null)
	const saveQueueRef = React.useRef(new SaveQueue(saveDocument))

	const persistDocument = React.useCallback((nextDocument: ZoltraakDocument) => {
		documentRef.current = nextDocument
		setDocument(nextDocument)
		return saveQueueRef.current.enqueue(nextDocument)
	}, [])

	const resetDocument = React.useCallback(async () => {
		const nextDocument = createDefaultDocument()
		documentRef.current = nextDocument
		setDocument(nextDocument)
		await saveQueueRef.current.enqueue(nextDocument)

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

	return {
		document,
		documentRef,
		persistDocument,
		resetDocument,
		updatePageScene,
	}
}
