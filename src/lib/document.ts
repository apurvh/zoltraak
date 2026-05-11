import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { openDB, type DBSchema } from 'idb'

const DB_NAME = 'zoltraak'
const DB_VERSION = 1
const DOCUMENT_STORE = 'documents'
const DOCUMENT_KEY = 'zoltraak-canvas'

export type StoredAppState = Partial<
	Pick<
		AppState,
		| 'currentItemBackgroundColor'
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
	elements: readonly ExcalidrawElement[]
	appState: StoredAppState
	files: BinaryFiles
}

export type ZoltraakDocument = {
	schemaVersion: 1
	currentPageId: string
	pages: ZoltraakPage[]
}

export type PageSummary = {
	id: string
	name: string
}

interface ZoltraakDb extends DBSchema {
	[DOCUMENT_STORE]: {
		key: string
		value: ZoltraakDocument
	}
}

function createId() {
	return globalThis.crypto?.randomUUID?.() ?? `page-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createBlankPage(name: string): ZoltraakPage {
	return {
		id: createId(),
		name,
		elements: [],
		appState: {
			currentItemRoughness: 0,
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
		currentPageId: firstPage.id,
		pages: [firstPage],
	}
}

export function getCurrentPage(document: ZoltraakDocument) {
	return document.pages.find((page) => page.id === document.currentPageId) ?? document.pages[0]
}

export function getPageSummaries(document: ZoltraakDocument): PageSummary[] {
	return document.pages.map((page) => ({ id: page.id, name: page.name }))
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
			page.id === pageId ? { ...page, elements: [...elements], appState, files: { ...files } } : page
		),
	}
}

async function getDb() {
	return openDB<ZoltraakDb>(DB_NAME, DB_VERSION, {
		upgrade(db) {
			if (!db.objectStoreNames.contains(DOCUMENT_STORE)) {
				db.createObjectStore(DOCUMENT_STORE)
			}
		},
	})
}

export async function loadDocument() {
	const db = await getDb()
	const document = await db.get(DOCUMENT_STORE, DOCUMENT_KEY)

	return document ?? createDefaultDocument()
}

export async function saveDocument(document: ZoltraakDocument) {
	const db = await getDb()
	await db.put(DOCUMENT_STORE, document, DOCUMENT_KEY)
}
