import mermaid from 'mermaid'

let renderCounter = 0

export async function renderMermaidToSvg(
	source: string
): Promise<{
	svg: string
	width: number
	height: number
}> {
	mermaid.initialize({
		startOnLoad: false,
		theme: 'default',
		fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
		flowchart: { useMaxWidth: true, htmlLabels: true },
		securityLevel: 'strict',
	})

	const id = `mermaid-render-${++renderCounter}`
	const { svg } = await mermaid.render(id, source.trim())

	const parser = new DOMParser()
	const doc = parser.parseFromString(svg, 'image/svg+xml')
	const svgEl = doc.querySelector('svg')

	let width = 400
	let height = 300
	let finalSvg = svg

	if (svgEl) {
		const viewBox = svgEl.getAttribute('viewBox')
		const PADDING = 30

		let viewBoxExists = false

		if (viewBox) {
			const parts = viewBox.split(/[\s,]+/).map(Number)
			if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
				parts[0] -= PADDING
				parts[1] -= PADDING
				parts[2] += PADDING * 2
				parts[3] += PADDING * 2

				width = parts[2]
				height = parts[3]
				svgEl.setAttribute('viewBox', parts.join(' '))
				viewBoxExists = true
			}
		}

		if (!viewBoxExists) {
			const attrWidth = parseFloat(svgEl.getAttribute('width') ?? '')
			const attrHeight = parseFloat(svgEl.getAttribute('height') ?? '')

			if (attrWidth > 0 && attrHeight > 0) {
				width = attrWidth + PADDING * 2
				height = attrHeight + PADDING * 2
			}
		}

		svgEl.setAttribute('width', width.toString())
		svgEl.setAttribute('height', height.toString())

		// Remove max-width constraints that might conflict with canvas scaling
		const currentStyle = svgEl.getAttribute('style') || ''
		const newStyle = currentStyle.replace(/max-width:\s*[^;]+;?/g, '').trim()
		if (newStyle) {
			svgEl.setAttribute('style', newStyle)
		} else {
			svgEl.removeAttribute('style')
		}

		finalSvg = svgEl.outerHTML
	}

	return { svg: finalSvg, width, height }
}

export function svgToDataUrl(svg: string): string {
	return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}
