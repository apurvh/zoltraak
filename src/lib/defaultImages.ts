import databaseAssetUrl from '../assets/default-images/database.svg'
import mobileAppAssetUrl from '../assets/default-images/mobile-app.svg'
import objectStorageBucketAssetUrl from '../assets/default-images/object-storage-bucket.svg'
import queueAssetUrl from '../assets/default-images/queue.svg'
import stickAdminAssetUrl from '../assets/default-images/stick-admin.svg'
import stickUserAssetUrl from '../assets/default-images/stick-user.svg'
import webAppAssetUrl from '../assets/default-images/web-app.svg'
import databaseSvg from '../assets/default-images/database.svg?raw'
import mobileAppSvg from '../assets/default-images/mobile-app.svg?raw'
import objectStorageBucketSvg from '../assets/default-images/object-storage-bucket.svg?raw'
import queueSvg from '../assets/default-images/queue.svg?raw'
import stickAdminSvg from '../assets/default-images/stick-admin.svg?raw'
import stickUserSvg from '../assets/default-images/stick-user.svg?raw'
import webAppSvg from '../assets/default-images/web-app.svg?raw'

export type DefaultImage = {
	assetUrl: string
	dataUrl: string
	height: number
	id: string
	label: string
	mimeType: 'image/svg+xml'
	searchTerms: readonly string[]
	width: number
}

function svgToDataUrl(svg: string) {
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export const defaultImages: readonly DefaultImage[] = [
	{
		assetUrl: stickUserAssetUrl,
		dataUrl: svgToDataUrl(stickUserSvg),
		height: 160,
		id: 'stick-user',
		label: 'Stick User',
		mimeType: 'image/svg+xml',
		searchTerms: ['stick', 'user', 'person', 'actor'],
		width: 160,
	},
	{
		assetUrl: stickAdminAssetUrl,
		dataUrl: svgToDataUrl(stickAdminSvg),
		height: 160,
		id: 'stick-admin',
		label: 'Stick Admin',
		mimeType: 'image/svg+xml',
		searchTerms: ['stick', 'admin', 'user', 'person', 'shield'],
		width: 160,
	},
	{
		assetUrl: databaseAssetUrl,
		dataUrl: svgToDataUrl(databaseSvg),
		height: 160,
		id: 'database',
		label: 'Database',
		mimeType: 'image/svg+xml',
		searchTerms: ['database', 'db', 'storage', 'data'],
		width: 160,
	},
	{
		assetUrl: queueAssetUrl,
		dataUrl: svgToDataUrl(queueSvg),
		height: 96,
		id: 'queue',
		label: 'Queue',
		mimeType: 'image/svg+xml',
		searchTerms: ['queue', 'message', 'messages', 'buffer', 'stream'],
		width: 200,
	},
	{
		assetUrl: webAppAssetUrl,
		dataUrl: svgToDataUrl(webAppSvg),
		height: 140,
		id: 'web-app',
		label: 'Web App',
		mimeType: 'image/svg+xml',
		searchTerms: ['web', 'app', 'browser', 'frontend', 'site'],
		width: 180,
	},
	{
		assetUrl: mobileAppAssetUrl,
		dataUrl: svgToDataUrl(mobileAppSvg),
		height: 180,
		id: 'mobile-app',
		label: 'Mobile App',
		mimeType: 'image/svg+xml',
		searchTerms: ['mobile', 'app', 'phone', 'ios', 'android'],
		width: 120,
	},
	{
		assetUrl: objectStorageBucketAssetUrl,
		dataUrl: svgToDataUrl(objectStorageBucketSvg),
		height: 160,
		id: 'object-storage-bucket',
		label: 'Object Storage Bucket',
		mimeType: 'image/svg+xml',
		searchTerms: ['object', 'storage', 'bucket', 's3', 'blob'],
		width: 180,
	},
]

export function getDefaultImageFileId(image: DefaultImage) {
	return `default-image-${image.id}`
}

export function matchesDefaultImage(image: DefaultImage, query: string) {
	const normalizedQuery = query.trim().toLowerCase()
	if (!normalizedQuery) return true

	const searchableText = [image.label, image.id, ...image.searchTerms].join(' ').toLowerCase()

	return normalizedQuery
		.split(/\s+/)
		.every((part) => searchableText.includes(part))
}
