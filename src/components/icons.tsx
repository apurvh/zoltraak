import React from 'react'

type IconProps = React.SVGProps<SVGSVGElement>

const defaultProps: IconProps = {
	xmlns: 'http://www.w3.org/2000/svg',
	width: 16,
	height: 16,
	viewBox: '0 0 24 24',
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 2,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
}

export function FileIcon(props: IconProps) {
	return (
		<svg {...defaultProps} {...props}>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
		</svg>
	)
}

export function FilePlusIcon(props: IconProps) {
	return (
		<svg {...defaultProps} {...props}>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="12" y1="18" x2="12" y2="12" />
			<line x1="9" y1="15" x2="15" y2="15" />
		</svg>
	)
}

export function WandIcon(props: IconProps) {
	return (
		<svg {...defaultProps} {...props}>
			<path d="M15 4V2" />
			<path d="M15 16v-2" />
			<path d="M8 9h2" />
			<path d="M20 9h2" />
			<path d="M17.8 11.8l1.4 1.4" />
			<path d="M15 9h0" />
			<path d="M17.8 6.2l1.4-1.4" />
			<path d="M3 21l9-9" />
			<path d="M12.2 6.2l-1.4-1.4" />
		</svg>
	)
}
