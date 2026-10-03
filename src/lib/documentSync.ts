import type { ZoltraakDocument, ZoltraakPage } from './document'

export type DocumentPatch = {
	sourceTabId: string
	updatedAt: number
	currentPageId: string
	pageIds: string[]
	pages: Array<ZoltraakPage & { fileIds: string[] }>
}

export function createDocumentPatch(document: ZoltraakDocument, previous: ZoltraakDocument | undefined, sourceTabId: string): DocumentPatch {
	const previousPages = new Map(previous?.pages.map((page) => [page.id, page]))
	return {
		sourceTabId, updatedAt: document.updatedAt, currentPageId: document.currentPageId,
		pageIds: document.pages.map((page) => page.id),
		pages: document.pages.filter((page) => page !== previousPages.get(page.id)).map((page) => ({
			...page,
			fileIds: Object.keys(page.files),
			files: Object.fromEntries(Object.entries(page.files).filter(([id, file]) => file !== previousPages.get(page.id)?.files[id])),
		})),
	}
}

export function isDocumentPatch(value: unknown): value is DocumentPatch {
	if (!value || typeof value !== 'object') return false
	const patch = value as DocumentPatch
	return typeof patch.sourceTabId === 'string' && typeof patch.updatedAt === 'number' &&
		typeof patch.currentPageId === 'string' && Array.isArray(patch.pageIds) &&
		patch.pageIds.every((id) => typeof id === 'string') && Array.isArray(patch.pages) &&
		patch.pages.every((page) => page && typeof page.id === 'string' && typeof page.updatedAt === 'number' &&
			Array.isArray(page.elements) && Array.isArray(page.fileIds) && !!page.files && !!page.appState)
}

export function applyDocumentPatch(document: ZoltraakDocument, patch: DocumentPatch): ZoltraakDocument {
	const isNewer = patch.updatedAt > document.updatedAt
	const pages = new Map(document.pages.map((page) => [page.id, page]))
	for (const changedPage of patch.pages) {
		const previous = pages.get(changedPage.id)
		if (!previous && !isNewer) continue
		if (previous && previous.updatedAt > changedPage.updatedAt) continue
		const { fileIds, files: changedFiles, ...page } = changedPage
		const files = { ...previous?.files, ...changedFiles }
		pages.set(page.id, { ...page, files: Object.fromEntries(fileIds.filter((id) => files[id]).map((id) => [id, files[id]])) })
	}
	return {
		...document,
		updatedAt: Math.max(document.updatedAt, patch.updatedAt),
		currentPageId: isNewer ? patch.currentPageId : document.currentPageId,
		pages: (isNewer ? patch.pageIds : [...pages.keys()]).filter((id) => pages.has(id)).map((id) => pages.get(id)!),
	}
}
