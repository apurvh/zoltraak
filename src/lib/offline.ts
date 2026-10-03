// Set this before Excalidraw is imported so its fonts resolve locally.
window.EXCALIDRAW_ASSET_PATH = new URL(`${import.meta.env.BASE_URL}excalidraw/`, window.location.origin).href

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
	const register = () => {
		navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
			console.error('Could not prepare offline access', error)
		})
	}
	if (document.readyState === 'complete') register()
	else window.addEventListener('load', register, { once: true })
}
declare global {
	interface Window {
		EXCALIDRAW_ASSET_PATH: string
	}
}
