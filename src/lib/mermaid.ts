import mermaid from 'mermaid'

let initialized = false

function ensureInitialized() {
	if (initialized) return
	initialized = true

	mermaid.initialize({
		startOnLoad: false,
		theme: 'default',
		fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
		flowchart: { useMaxWidth: true, htmlLabels: true },
		securityLevel: 'strict',
	})
}

let renderCounter = 0

export async function renderMermaidToSvg(source: string): Promise<{
	svg: string
	width: number
	height: number
}> {
	ensureInitialized()

	const id = `mermaid-render-${++renderCounter}`
	const { svg } = await mermaid.render(id, source.trim())

	const parser = new DOMParser()
	const doc = parser.parseFromString(svg, 'image/svg+xml')
	const svgEl = doc.querySelector('svg')

	let width = 400
	let height = 300

	if (svgEl) {
		const viewBox = svgEl.getAttribute('viewBox')

		if (viewBox) {
			const parts = viewBox.split(/[\s,]+/).map(Number)
			if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
				width = parts[2]
				height = parts[3]
			}
		}

		const attrWidth = parseFloat(svgEl.getAttribute('width') ?? '')
		const attrHeight = parseFloat(svgEl.getAttribute('height') ?? '')

		if (attrWidth > 0 && attrHeight > 0) {
			width = attrWidth
			height = attrHeight
		}
	}

	return { svg, width, height }
}

export function svgToDataUrl(svg: string): string {
	return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}
