# Tech Stack

Use this stack:

- Vite + React + TypeScript
- Excalidraw React package
- idb for client-only IndexedDB persistence
- Playwright for browser-level workflow tests
- Vitest only for small pure helpers, if needed
- Vercel static deployment

## Why Excalidraw

Use Excalidraw instead of tldraw, Konva, or Fabric. The goal is a focused drawing app with minimal custom canvas code and a fully open-source production deployment.

Excalidraw provides the core editor surface: drawing, arrows, text, images, copy/paste, undo/redo, zoom, pan, default tools, default shapes, UI, and editor APIs. A single `<Excalidraw />` creates a working single-user canvas, and the app can customize behavior with the imperative API. See the [Excalidraw React integration docs](https://excalidraw-excalidraw.mintlify.app/examples).

Keep app code limited to:

- Restricting or removing tools
- Setting the fixed color palette
- Customizing the UI
- Managing app-owned pages
- Configuring local IndexedDB persistence
- Adding export/import if needed
- Testing the required workflows

Use an app-owned document model for pages. Each page stores Excalidraw elements, serializable app state, and files. Persist the document in IndexedDB with `idb` under the `zoltraak-canvas` key.

Do not add Zustand or Dexie at first. Keep the document model in React state and IndexedDB. Add a separate store only for app preferences such as theme, palette choice, or toolbar configuration.

## Testing

Use Playwright as the main test suite:

- Create shapes
- Draw arrows
- Add text
- Paste or drop images
- Change colors
- Reload and verify persistence
- Capture visual snapshots for critical scenes

Use small fixture snapshots for deterministic shape-record assertions. Avoid backend tests unless a backend is added.
