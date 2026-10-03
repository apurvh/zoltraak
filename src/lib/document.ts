import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

const DB_NAME = 'zoltraak'
const DB_VERSION = 2
const DOCUMENT_STORE = 'documents'
const DOCUMENT_KEY = 'zoltraak-canvas'

export type StoredAppState = Partial<
	Pick<
		AppState,
		| 'currentItemBackgroundColor'
		| 'currentItemEndArrowhead'
		| 'currentItemFillStyle'
		| 'currentItemFontFamily'
		| 'currentItemFontSize'
		| 'currentItemOpacity'
		| 'currentItemRoughness'
		| 'currentItemRoundness'
		| 'currentItemStrokeColor'
		| 'currentItemStrokeStyle'
		| 'currentItemStrokeWidth'
		| 'gridModeEnabled'
		| 'name'
		| 'scrollX'
		| 'scrollY'
		| 'theme'
		| 'viewBackgroundColor'
		| 'zenModeEnabled'
		| 'zoom'
	>
>

export type ZoltraakPage = {
	id: string
	name: string
	updatedAt: number
	elements: readonly ExcalidrawElement[]
	appState: StoredAppState
	files: BinaryFiles
}

export type ZoltraakDocument = {
	schemaVersion: 1
	updatedAt: number
	currentPageId: string
	pages: ZoltraakPage[]
}

export type PageSummary = {
	id: string
	name: string
	updatedAt: number
}

type StoredDocument = Omit<ZoltraakDocument, 'pages'> & { pageIds: string[] }

interface ZoltraakDb extends DBSchema {
	[DOCUMENT_STORE]: {
		key: string
		value: StoredDocument | ZoltraakDocument
	}
	pages: {
		key: string
		value: Omit<ZoltraakPage, 'files'>
	}
	files: {
		key: [string, string]
		value: { pageId: string; file: BinaryFiles[string] }
		indexes: { byPage: string }
	}
}

function createId() {
	return globalThis.crypto?.randomUUID?.() ?? `page-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createBlankPage(name: string): ZoltraakPage {
	return {
		id: createId(),
		name,
		updatedAt: Date.now(),
		elements: [],
		appState: {
			currentItemEndArrowhead: 'triangle_outline',
			currentItemRoughness: 0.5,
			currentItemRoundness: 'round',
			viewBackgroundColor: '#ffffff',
		},
		files: {},
	}
}

export function createDefaultDocument(): ZoltraakDocument {
	const firstPage = createBlankPage('Page 1')

	return {
		schemaVersion: 1,
		updatedAt: Date.now(),
		currentPageId: firstPage.id,
		pages: [firstPage],
	}
}

export function withUpdatedAt(document: ZoltraakDocument): ZoltraakDocument {
	return {
		...document,
		updatedAt: Math.max(Date.now(), document.updatedAt + 1),
	}
}

export function getCurrentPage(document: ZoltraakDocument) {
	return document.pages.find((page) => page.id === document.currentPageId) ?? document.pages[0]
}

export function getPageSummaries(document: ZoltraakDocument): PageSummary[] {
	return document.pages.map((page) => ({ id: page.id, name: page.name, updatedAt: page.updatedAt }))
}

export function getNextPageName(pages: PageSummary[]) {
	const usedNames = new Set(pages.map((page) => page.name))
	let index = pages.length + 1

	while (usedNames.has(`Page ${index}`)) {
		index += 1
	}

	return `Page ${index}`
}

export function serializeAppState(appState: AppState): StoredAppState {
	return {
		currentItemBackgroundColor: appState.currentItemBackgroundColor,
		currentItemEndArrowhead: appState.currentItemEndArrowhead,
		currentItemFillStyle: appState.currentItemFillStyle,
		currentItemFontFamily: appState.currentItemFontFamily,
		currentItemFontSize: appState.currentItemFontSize,
		currentItemOpacity: appState.currentItemOpacity,
		currentItemRoughness: appState.currentItemRoughness,
		currentItemRoundness: appState.currentItemRoundness,
		currentItemStrokeColor: appState.currentItemStrokeColor,
		currentItemStrokeStyle: appState.currentItemStrokeStyle,
		currentItemStrokeWidth: appState.currentItemStrokeWidth,
		gridModeEnabled: appState.gridModeEnabled,
		name: appState.name,
		scrollX: appState.scrollX,
		scrollY: appState.scrollY,
		theme: appState.theme,
		viewBackgroundColor: appState.viewBackgroundColor,
		zenModeEnabled: appState.zenModeEnabled,
		zoom: appState.zoom,
	}
}

export function withPageScene(
	document: ZoltraakDocument,
	pageId: string,
	elements: readonly ExcalidrawElement[],
	appState: StoredAppState,
	files: BinaryFiles
): ZoltraakDocument {
	return {
		...document,
		pages: document.pages.map((page) =>
			page.id === pageId
				? { ...page, updatedAt: Math.max(Date.now(), page.updatedAt + 1), elements: [...elements], appState, files: { ...files } }
				: page
		),
	}
}

function normalizeDocument(document: ZoltraakDocument): ZoltraakDocument {
	const updatedAt = document.updatedAt ?? 0

	return {
		...document,
		updatedAt,
		pages: document.pages.map((page) => ({
			...page,
			updatedAt: page.updatedAt ?? updatedAt,
		})),
	}
}

let database: Promise<IDBPDatabase<ZoltraakDb>> | undefined

function getDb() {
	if (database) return database
	database = openDB<ZoltraakDb>(DB_NAME, DB_VERSION, {
		upgrade(db) {
			if (!db.objectStoreNames.contains(DOCUMENT_STORE)) {
				db.createObjectStore(DOCUMENT_STORE)
			}
			if (!db.objectStoreNames.contains('pages')) db.createObjectStore('pages')
			if (!db.objectStoreNames.contains('files')) {
				db.createObjectStore('files').createIndex('byPage', 'pageId')
			}
		},
		blocking() {
			void database?.then((db) => db.close())
			database = undefined
		},
		terminated() { database = undefined },
	}).catch((error) => {
		database = undefined
		throw error
	})
	return database
}

export async function loadDocument() {
	const db = await getDb()
	// Keep metadata, pages and images in one snapshot if another tab saves during loading.
	const transaction = db.transaction(['documents', 'pages', 'files'])
	const stored = await transaction.objectStore(DOCUMENT_STORE).get(DOCUMENT_KEY)
	if (!stored) return createDefaultDocument()
	if ('pages' in stored) {
		// Move the old single-record format atomically, keeping existing drawings and images.
		const document = normalizeDocument(stored)
		await transaction.done
		await saveDocument(document)
		return document
	}
	const [pages, files] = await Promise.all([
		Promise.all(stored.pageIds.map((id) => transaction.objectStore('pages').get(id))),
		transaction.objectStore('files').getAll(),
	])
	const filesByPage = new Map<string, BinaryFiles>()
	for (const { pageId, file } of files) {
		const pageFiles = filesByPage.get(pageId) ?? {}
		pageFiles[file.id] = file
		filesByPage.set(pageId, pageFiles)
	}
	const { pageIds: _pageIds, ...metadata } = stored
	return normalizeDocument({
		...metadata,
		pages: pages.filter((page): page is NonNullable<typeof page> => !!page)
			.map((page) => ({ ...page, files: filesByPage.get(page.id) ?? {} })),
	})
}

export async function saveDocument(document: ZoltraakDocument, previous?: ZoltraakDocument) {
	const db = await getDb()
	const transaction = db.transaction(['documents', 'pages', 'files'], 'readwrite')
	try {
		const previousPages = new Map(previous?.pages.map((page) => [page.id, page]))
		const documents = transaction.objectStore('documents')
		const pages = transaction.objectStore('pages')
		const files = transaction.objectStore('files')
		const stored = await documents.get(DOCUMENT_KEY)
		if (!stored || document.updatedAt >= stored.updatedAt) {
			const { pages: _pages, ...metadata } = document
			await documents.put({ ...metadata, pageIds: document.pages.map((page) => page.id) }, DOCUMENT_KEY)
			for (const oldPage of previous?.pages ?? []) {
				if (document.pages.some((page) => page.id === oldPage.id)) continue
				await pages.delete(oldPage.id)
				for (const key of await files.index('byPage').getAllKeys(oldPage.id)) await files.delete(key)
			}
		}
		for (const page of document.pages) {
			const oldPage = previousPages.get(page.id)
			if (page === oldPage) continue
			const storedPage = await pages.get(page.id)
			if (storedPage && storedPage.updatedAt > page.updatedAt) continue
			const { files: pageFiles, ...pageData } = page
			await pages.put(pageData, page.id)
			for (const [id, file] of Object.entries(pageFiles)) {
				if (file !== oldPage?.files[id]) await files.put({ pageId: page.id, file }, [page.id, id])
			}
			for (const id of Object.keys(oldPage?.files ?? {})) {
				if (!pageFiles[id]) await files.delete([page.id, id])
			}
		}
		await transaction.done
	} catch (error) {
		try { transaction.abort() } catch { /* It may already have aborted. */ }
		await transaction.done.catch(() => {})
		throw error
	}
}
