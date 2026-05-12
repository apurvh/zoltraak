import { StateEffect, StateField, Prec } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, showPanel, Panel } from '@codemirror/view'

export type FlashMarker = { pos: number; label: string }
export type FlashState = {
	active: boolean
	searchString: string
	markers: FlashMarker[]
}

const defaultState: FlashState = { active: false, searchString: '', markers: [] }

export const enableFlashEffect = StateEffect.define<void>()
export const disableFlashEffect = StateEffect.define<void>()
export const setFlashSearchEffect = StateEffect.define<{ searchString: string; markers: FlashMarker[] }>()

export const flashStateField = StateField.define<FlashState>({
	create() {
		return defaultState
	},
	update(value, tr) {
		let next = value
		for (const effect of tr.effects) {
			if (effect.is(enableFlashEffect)) {
				next = { active: true, searchString: '', markers: [] }
			} else if (effect.is(disableFlashEffect)) {
				next = defaultState
			} else if (effect.is(setFlashSearchEffect)) {
				next = { ...next, searchString: effect.value.searchString, markers: effect.value.markers }
			}
		}
		return next
	},
	provide: (f) => showPanel.from(f, (state) => (state.active ? createFlashPanel : null)),
})

function createFlashPanel(view: EditorView): Panel {
	const dom = document.createElement('div')
	dom.className = 'cm-flash-panel cm-dialog'
	dom.textContent = `⚡ Flash: `

	return {
		top: false,
		dom,
		update(update) {
			const state = update.state.field(flashStateField)
			if (state.active) {
				dom.textContent = `⚡ Flash: ${state.searchString}`
			}
		},
	}
}

class FlashBadgeWidget extends WidgetType {
	constructor(readonly label: string) {
		super()
	}
	eq(other: FlashBadgeWidget) {
		return other.label === this.label
	}
	toDOM() {
		const span = document.createElement('span')
		span.className = 'cm-flash-badge'
		span.textContent = this.label
		return span
	}
}

export const flashDecorations = EditorView.decorations.compute([flashStateField], (state) => {
	const flash = state.field(flashStateField)
	if (!flash.active || !flash.markers.length) return Decoration.none

	const decos = flash.markers.map((m) =>
		Decoration.widget({ widget: new FlashBadgeWidget(m.label), side: 1 }).range(m.pos)
	)
	decos.sort((a, b) => a.from - b.from)

	return Decoration.set(decos)
})

export const flashAttributes = EditorView.editorAttributes.compute([flashStateField], (state) => {
	const flash = state.field(flashStateField)
	return flash.active ? { class: 'cm-flash-active' } : {}
})

function calculateMarkers(doc: string, searchString: string): FlashMarker[] {
	if (!searchString) return []

	const lowerDoc = doc.toLowerCase()
	const lowerSearch = searchString.toLowerCase()
	const indices: number[] = []
	let i = 0
	while (i < lowerDoc.length) {
		const matchIdx = lowerDoc.indexOf(lowerSearch, i)
		if (matchIdx === -1) break
		indices.push(matchIdx)
		i = matchIdx + 1
	}

	if (indices.length === 0) return []

	const nextChars = new Set<string>()
	for (const idx of indices) {
		const nextCharIdx = idx + searchString.length
		if (nextCharIdx < lowerDoc.length) {
			const c = lowerDoc[nextCharIdx]
			if (/[a-z]/.test(c)) {
				nextChars.add(c)
			}
		}
	}

	const allLabels = 'abcdefghijklmnopqrstuvwxyz'.split('')
	const safeLabels = allLabels.filter((l) => !nextChars.has(l))
	const labelsToUse = safeLabels.length > 0 ? safeLabels : allLabels

	const markers: FlashMarker[] = []
	let labelIdx = 0
	for (const idx of indices) {
		if (labelIdx < labelsToUse.length) {
			markers.push({ pos: idx, label: labelsToUse[labelIdx] })
			labelIdx++
		} else {
			break
		}
	}

	return markers
}

export const flashKeyHandler = EditorView.domEventHandlers({
	keydown(event, view) {
		const state = view.state.field(flashStateField, false)
		if (!state || !state.active) return false

		event.preventDefault()
		event.stopPropagation()

		if (event.key === 'Escape') {
			view.dispatch({ effects: disableFlashEffect.of() })
			return true
		}

		if (event.key === 'Backspace') {
			if (state.searchString.length > 0) {
				const newSearch = state.searchString.slice(0, -1)
				if (newSearch === '') {
					view.dispatch({ effects: setFlashSearchEffect.of({ searchString: '', markers: [] }) })
				} else {
					const markers = calculateMarkers(view.state.doc.toString(), newSearch)
					view.dispatch({ effects: setFlashSearchEffect.of({ searchString: newSearch, markers }) })
				}
			} else {
				view.dispatch({ effects: disableFlashEffect.of() })
			}
			return true
		}

		if (event.key.length === 1) {
			const key = event.key.toLowerCase()

			// 1. Try to jump if it matches a safe label
			const match = state.markers.find((m) => m.label === key)
			if (match) {
				view.dispatch({
					selection: { anchor: match.pos },
					effects: disableFlashEffect.of(),
					scrollIntoView: true,
				})
				return true
			}

			// 2. Otherwise, treat as continuing the search
			const newSearch = state.searchString + key
			const markers = calculateMarkers(view.state.doc.toString(), newSearch)

			if (markers.length > 0) {
				view.dispatch({ effects: setFlashSearchEffect.of({ searchString: newSearch, markers }) })
			}
			// If 0 matches, ignore the keystroke
			return true
		}

		return true
	},
})

export function vimFlashExtension() {
	return [flashStateField, flashDecorations, flashAttributes, Prec.highest(flashKeyHandler)]
}
