import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb'

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
type LegacyPage = Omit<ZoltraakPage, 'updatedAt'> & { updatedAt?: number }
type LegacyDocument = Omit<ZoltraakDocument, 'pages' | 'updatedAt'> & { pages: LegacyPage[]; updatedAt?: number }

interface ZoltraakDb extends DBSchema {
	[DOCUMENT_STORE]: {
		key: string
		value: StoredDocument | LegacyDocument
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

function referencedFileIds(elements: readonly ExcalidrawElement[], includeDeleted: boolean) {
	const ids = new Set<string>()
	for (const element of elements) {
		if (element.type === 'image' && element.fileId && (includeDeleted || !element.isDeleted)) ids.add(element.fileId)
	}
	return ids
}

function unambiguousFile(pages: ZoltraakPage[], id: string, source?: BinaryFiles[string]) {
	for (const page of pages) {
		const file = page.files[id]
		if (!file) continue
		if (source && (file.dataURL !== source.dataURL || file.mimeType !== source.mimeType)) return undefined
		source ??= file
	}
	return source
}

export function getPageFiles(
	elements: readonly ExcalidrawElement[],
	editorFiles: BinaryFiles,
	page: ZoltraakPage,
	pages: ZoltraakPage[]
): BinaryFiles {
	const files: BinaryFiles = {}
	let previousImages: Set<string> | undefined
	for (const element of elements) {
		if (element.type !== 'image' || element.isDeleted || !element.fileId) continue
		let file: BinaryFiles[string] | undefined = page.files[element.fileId]
		const incoming = editorFiles[element.fileId]
		if (!file && incoming) {
			previousImages ??= referencedFileIds(page.elements, false)
			// The editor shares a file cache across pages. An existing broken image may
			// share its ID with unrelated bytes from a page that was opened earlier.
			file = previousImages.has(element.fileId) ? unambiguousFile(pages, element.fileId, incoming) : incoming
		}
		if (file) files[element.fileId] = file
	}
	// Legacy pages can have attachments without an image element. Keep those on their original page.
	const missingIds = Object.keys(page.files).filter((id) => !files[id])
	if (missingIds.length) {
		const previousIds = referencedFileIds(page.elements, true)
		for (const id of missingIds) {
			if (!previousIds.has(id)) files[id] = page.files[id]
		}
	}
	return files
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
	if (!document.pages.length) throw new Error('The saved board has no pages.')
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

let upgradeBlocked = false
const blockedListeners = new Set<() => void>()

function getDb() {
	if (database) return database
	database = openDB<ZoltraakDb>(DB_NAME, DB_VERSION, {
		blocked() {
			upgradeBlocked = true
			for (const notify of blockedListeners) notify()
		},
		upgrade(db) {
			upgradeBlocked = false
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
		upgradeBlocked = false
		database = undefined
		throw error
	})
	return database
}

export async function loadDocument(onBlocked?: () => void): Promise<ZoltraakDocument> {
	if (onBlocked) {
		blockedListeners.add(onBlocked)
		if (upgradeBlocked) onBlocked()
	}
	let db: IDBPDatabase<ZoltraakDb>
	try {
		db = await getDb()
	} finally {
		if (onBlocked) blockedListeners.delete(onBlocked)
	}
	// Keep metadata, pages and images in one snapshot if another tab saves during loading.
	const transaction = db.transaction(['documents', 'pages', 'files'])
	const [document] = await Promise.all([readSavedBoard(transaction), transaction.done])
	return document
}

async function readSavedBoard(transaction: IDBPTransaction<ZoltraakDb, ['documents', 'pages', 'files'], 'readonly'>) {
	const stored = await transaction.objectStore(DOCUMENT_STORE).get(DOCUMENT_KEY)
	if (!stored) return createDefaultDocument()
	if ('pages' in stored) {
		await transaction.done
		const migrated = await migrateLegacyBoard(transaction.db)
		// Another tab may have finished the migration while we waited for the writer.
		return migrated ?? loadDocument()
	}
	const document = await readSplitBoard(transaction, stored)
	if (!findImageRepairs(document.pages).length) return document
	await transaction.done
	return repairStoredImages(transaction.db)
}

async function readSplitBoard(
	transaction: IDBPTransaction<ZoltraakDb, ['documents', 'pages', 'files'], 'readonly' | 'readwrite'>,
	stored: StoredDocument
) {
	const [pages, files] = await Promise.all([
		Promise.all(stored.pageIds.map(async (id) => {
			const page = await transaction.objectStore('pages').get(id)
			if (!page) throw new Error('A saved page could not be found.')
			return page
		})),
		transaction.objectStore('files').getAll(),
	])
	const filesByPage = groupFilesByPage(files)
	const { pageIds: _pageIds, ...metadata } = stored
	return normalizeDocument({
		...metadata,
		pages: pages.map((page) => ({ ...page, files: filesByPage.get(page.id) ?? {} })),
	})
}

function groupFilesByPage(rows: ZoltraakDb['files']['value'][]) {
	const filesByPage = new Map<string, BinaryFiles>()
	for (const { pageId, file } of rows) {
		const files = filesByPage.get(pageId) ?? {}
		files[file.id] = file
		filesByPage.set(pageId, files)
	}
	return filesByPage
}

async function migrateLegacyBoard(db: IDBPDatabase<ZoltraakDb>) {
	const tx = db.transaction(['documents', 'pages', 'files'], 'readwrite')
	try {
		const documents = tx.objectStore('documents')
		const pages = tx.objectStore('pages')
		const files = tx.objectStore('files')
		const legacy = await documents.get(DOCUMENT_KEY)
		if (!legacy || !('pages' in legacy)) {
			await tx.done
			return
		}

		// Older builds could write page edits without replacing timestamp-free metadata.
		const [splitPages, fileRows] = await Promise.all([pages.getAll(), files.getAll()])
		const splitFiles = groupFilesByPage(fileRows)
		const recovered = new Map<string, ZoltraakPage>()
		for (const page of legacy.pages) {
			recovered.set(page.id, {
				...page,
				updatedAt: page.updatedAt ?? legacy.updatedAt ?? 0,
				files: { ...splitFiles.get(page.id), ...page.files },
			})
		}
		// Map keeps the original order. Split-only pages append in IndexedDB key order.
		for (const split of splitPages) {
			const embedded = recovered.get(split.id)
			const updatedAt = split.updatedAt ?? 0
			if (embedded && embedded.updatedAt > updatedAt) continue
			recovered.set(split.id, { ...split, updatedAt, files: { ...embedded?.files, ...splitFiles.get(split.id) } })
		}
		const document = normalizeDocument({ ...legacy, updatedAt: legacy.updatedAt ?? 0, pages: [...recovered.values()] })
		if (!recovered.has(document.currentPageId)) document.currentPageId = document.pages[0].id
		for (const page of document.pages) document.updatedAt = Math.max(document.updatedAt, page.updatedAt)

		for (const { page, file } of findImageRepairs(document.pages)) {
			page.files[file.id] = file
		}
		for (const page of document.pages) {
			const { files: pageFiles, ...pageData } = page
			await pages.put(pageData, page.id)
			for (const [id, file] of Object.entries(pageFiles)) {
				if (file !== splitFiles.get(page.id)?.[id]) await files.put({ pageId: page.id, file }, [page.id, id])
			}
		}
		const { pages: migratedPages, ...metadata } = document
		await documents.put({ ...metadata, pageIds: migratedPages.map((page) => page.id) }, DOCUMENT_KEY)
		await tx.done
		return document
	} catch (error) {
		try { tx.abort() } catch { /* It may already have aborted. */ }
		await tx.done.catch(() => {})
		throw error
	}
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
		if (!stored || document.updatedAt >= (stored.updatedAt ?? 0)) {
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

function findImageRepairs(pages: ZoltraakPage[]) {
	const repairs: { page: ZoltraakPage; file: BinaryFiles[string] }[] = []
	if (pages.length < 2) return repairs
	const missing = new Map<string, ZoltraakPage[]>()
	for (const page of pages) {
		for (const id of referencedFileIds(page.elements, false)) {
			if (page.files[id]) continue
			const targets = missing.get(id)
			if (targets) targets.push(page)
			else missing.set(id, [page])
		}
	}
	for (const [id, targets] of missing) {
		const source = unambiguousFile(pages, id)
		if (source) {
			for (const page of targets) repairs.push({ page, file: source })
		}
	}
	return repairs
}

async function repairStoredImages(db: IDBPDatabase<ZoltraakDb>): Promise<ZoltraakDocument> {
	const tx = db.transaction(['documents', 'pages', 'files'], 'readwrite')
	let readableBoard: ZoltraakDocument | undefined
	try {
		const stored = await tx.objectStore('documents').get(DOCUMENT_KEY)
		if (!stored || 'pages' in stored) {
			await tx.done
			return loadDocument()
		}
		// Another tab may have changed the references or the available bytes since the first read.
		const document = await readSplitBoard(tx, stored)
		const repairs = findImageRepairs(document.pages)
		if (repairs.length) readableBoard = document
		for (const { page, file } of repairs) {
			await tx.objectStore('files').add({ pageId: page.id, file }, [page.id, file.id])
		}
		await tx.done
		for (const { page, file } of repairs) page.files[file.id] = file
		return document
	} catch (error) {
		try { tx.abort() } catch { /* It may already have aborted. */ }
		await tx.done.catch(() => {})
		if (!readableBoard) throw error
		// A failed repair must still allow the latest readable board to open.
		console.warn('Could not restore missing image files', error)
		return readableBoard
	}
}
