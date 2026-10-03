import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { createRequire } from 'node:module'
import type { Plugin } from 'vite'

const require = createRequire(import.meta.url)
const fontDirectory = join(dirname(require.resolve('@excalidraw/excalidraw')), 'fonts')

export function offline(): Plugin {
	return {
		name: 'zoltraak-offline',
		enforce: 'post',
		configureServer(server) {
			server.middlewares.use('/excalidraw/fonts', (request, response, next) => {
				const path = decodeURIComponent((request.url ?? '').split('?')[0])
				const file = join(fontDirectory, path)
				if (relative(fontDirectory, file).startsWith('..') || !file.endsWith('.woff2')) return next()
				try {
					response.setHeader('Content-Type', 'font/woff2')
					response.end(readFileSync(file))
				} catch { next() }
			})
		},
		generateBundle(_options, bundle) {
			const fontFiles: string[] = []
			function emitFonts(directory: string) {
				for (const entry of readdirSync(directory, { withFileTypes: true })) {
					const file = join(directory, entry.name)
					if (entry.isDirectory()) emitFonts(file)
					else if (entry.name.endsWith('.woff2')) {
						const fileName = `excalidraw/fonts/${relative(fontDirectory, file)}`
						fontFiles.push(fileName)
						thisPlugin.emitFile({ type: 'asset', fileName, source: readFileSync(file) })
					}
				}
			}
			const thisPlugin = this
			emitFonts(fontDirectory)
			const files = [...new Set(['index.html', ...Object.keys(bundle), ...fontFiles])]
			const hash = createHash('sha256')
			for (const file of files.sort()) {
				hash.update(file)
				const asset = bundle[file]
				if (asset) hash.update(asset.type === 'chunk' ? asset.code : asset.source)
				else if (file.startsWith('excalidraw/fonts/')) hash.update(readFileSync(join(fontDirectory, file.slice('excalidraw/fonts/'.length))))
			}
			this.emitFile({
				type: 'asset', fileName: 'sw.js', source: `
const CACHE = 'zoltraak-app-${hash.digest('hex').slice(0, 16)}';
const FILES = ${JSON.stringify(files)};
const url = (path) => new URL(path, self.registration.scope).href;
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await cache.addAll(FILES.map(url));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('zoltraak-app-') && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // These are fixed, same-origin build files. Preview/CDN Vary: Origin headers
    // must not make a module request miss its precached copy.
    const cached = await cache.match(request.mode === 'navigate' ? url('index.html') : request, { ignoreVary: true });
    return cached || fetch(request);
  })());
});
`,
			})
		},
	}
}
