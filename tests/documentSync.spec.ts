import { expect, test } from '@playwright/test'
import { createBlankPage, createDefaultDocument, withPageScene, withUpdatedAt } from '../src/lib/document'
import { applyDocumentPatch, createDocumentPatch } from '../src/lib/documentSync'

test('page patches keep unchanged pages and images without sending them again', () => {
	const original = createDefaultDocument()
	original.pages.push(createBlankPage('Other page'))
	const file = { id: 'image', dataURL: 'data:image/svg+xml,<svg/>', mimeType: 'image/svg+xml', created: 1 } as any
	original.pages[0].files = { image: file }
	const next = withUpdatedAt(withPageScene(original, original.currentPageId, [], { theme: 'dark' }, { image: file }))
	const patch = createDocumentPatch(next, original, 'sender')
	expect(patch.pages).toHaveLength(1)
	expect(patch.pages[0].files).toEqual({})
	const received = applyDocumentPatch(original, patch)
	expect(received.pages[0].files.image).toBe(file)
	expect(received.pages[0].appState.theme).toBe('dark')
	expect(received.pages[1]).toBe(original.pages[1])
})

test('a reset patch removes old pages and their images', () => {
	const original = createDefaultDocument()
	original.pages.push(createBlankPage('Other page'))
	const reset = withUpdatedAt({ ...createDefaultDocument(), updatedAt: original.updatedAt })
	const patch = createDocumentPatch(reset, original, 'sender')
	expect(applyDocumentPatch(original, patch)).toEqual(reset)
	// A delayed message from another tab must not bring the deleted page back.
	expect(applyDocumentPatch(reset, createDocumentPatch(original, undefined, 'stale-tab'))).toEqual(reset)
})
