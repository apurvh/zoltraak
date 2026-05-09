# Tech Stack

Use this stack:

- Vite + React + TypeScript
- tldraw SDK
- Playwright for browser-level workflow tests
- Vitest only for small pure helpers, if needed
- Vercel static deployment

## Why tldraw

Use tldraw instead of Konva or Fabric. The goal is a focused drawing app with minimal custom canvas code, not a canvas engine project.

tldraw already provides the core editor surface: drawing, text, images and video, copy/paste, undo/redo, zoom, pan, default tools, default shapes, UI, and editor APIs. A single `<Tldraw />` creates a working single-user canvas, and the SDK can be customized for project-specific tools, UI, and behavior. See the [tldraw quick start](https://tldraw.dev/quick-start).

Keep app code limited to:

- Restricting or removing tools
- Setting the fixed color palette
- Customizing the UI
- Configuring local persistence
- Adding export/import if needed
- Testing the required workflows

Use `persistenceKey` for client-only IndexedDB persistence. tldraw saves the document locally, stores assets with it, loads on mount, and syncs tabs that share the same key. See [tldraw persistence](https://tldraw.dev/sdk-features/persistence) and [tldraw assets](https://tldraw.dev/docs/assets).

Do not add Zustand or Dexie at first. Let tldraw own scene state. Add a separate store only for app preferences such as theme, palette choice, or toolbar configuration.

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
