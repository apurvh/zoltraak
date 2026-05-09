import { Editor, PageRecordType, type TLPageId } from 'tldraw'

export type PageSummary = {
	id: TLPageId
	name: string
}

export function getPageSummaries(editor: Editor): PageSummary[] {
	return editor.getPages().map((page) => ({ id: page.id, name: page.name }))
}

export function getNextPageName(pages: PageSummary[]) {
	const usedNames = new Set(pages.map((page) => page.name))
	let index = pages.length + 1

	while (usedNames.has(`Page ${index}`)) {
		index += 1
	}

	return `Page ${index}`
}

export function createAndSwitchToPage(editor: Editor, name: string) {
	const pageId = PageRecordType.createId()

	editor.run(() => {
		editor.markHistoryStoppingPoint('creating page from switcher')
		editor.createPage({ id: pageId, name })
		editor.setCurrentPage(pageId)
	})
}
