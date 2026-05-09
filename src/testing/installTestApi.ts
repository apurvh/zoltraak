import { Editor } from 'tldraw'
import { getPageSummaries } from '../lib/pages'

declare global {
	interface Window {
		__zoltraakTestApi?: {
			getCurrentToolId: () => string
			getShapes: () => Array<{ id: string; type: string; props: Record<string, unknown> }>
			getSelectedShapeIds: () => string[]
			getCurrentPageId: () => string
			getPages: () => Array<{ id: string; name: string }>
			resetDocument: () => void
		}
	}
}

function resetDocument(editor: Editor) {
	editor.run(() => {
		editor.markHistoryStoppingPoint('reset document')
		const pages = editor.getPages()
		const firstPage = pages[0]

		if (!firstPage) return

		editor.setCurrentPage(firstPage.id)
		for (const page of pages.slice(1)) {
			editor.deletePage(page.id)
		}

		editor.updatePage({ id: firstPage.id, name: 'Page 1' })
		editor.deleteShapes([...editor.getCurrentPageShapeIds()])
	})
}

export function installTestApi(editor: Editor) {
	if (!import.meta.env.DEV) return

	window.__zoltraakTestApi = {
		getCurrentToolId: () => editor.getCurrentToolId(),
		getShapes: () =>
			editor.getCurrentPageShapesSorted().map((shape) => ({
				id: shape.id,
				type: shape.type,
				props: shape.props as Record<string, unknown>,
			})),
		getSelectedShapeIds: () => [...editor.getSelectedShapeIds()],
		getCurrentPageId: () => editor.getCurrentPageId(),
		getPages: () => getPageSummaries(editor),
		resetDocument: () => resetDocument(editor),
	}
}

export function uninstallTestApi() {
	delete window.__zoltraakTestApi
}
