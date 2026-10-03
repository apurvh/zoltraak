# zoltraak

## Local Development

Prerequisites:

- Node.js 20 or newer
- npm

Install dependencies:

```sh
npm install
```

Start the local dev server:

```sh
npm run dev
```

Vite prints the local URL in the terminal, usually `http://localhost:5173/`.

Run the production build:

```sh
npm run build
```

Run the end-to-end tests:

```sh
npm run test:e2e
```

## Offline access

The production app caches its code, fonts, images, and diagram editor after the first online visit. Once caching finishes, it can reload and work without internet. Drawings stay in this browser's IndexedDB storage.

Offline caching runs in production builds on HTTPS or localhost. Development mode uses local fonts but does not install a service worker. App updates take over after the old tabs close.

## Speed and offline tests

Run the drawing speed tests:

```sh
npm run test:e2e -- tests/performance.spec.ts
```

Run the production build, offline test, and startup speed test:

```sh
npm run test:production
```

The drawing benchmark uses ten pages with 500 shapes each and a drag with 60 pointer moves. It checks save counts, sync traffic, frame delays, and persistence after reload. Selection must cause zero saves and zero broadcasts. Startup is measured in three fresh browser sessions. Both tests print their measurements and attach JSON results to the Playwright report.

Local Chromium measurements on October 3, 2026:

| Measurement | Before | After |
| --- | ---: | ---: |
| Save batches during one drag | 65 | 4 |
| Sync payload during that drag, measured as JSON | 151 MB | 0.93 MB |
| Startup JavaScript, before compression | 2.50 MB | 1.37 MB |
| Median startup time | 238 ms | 183 ms |

Drawing frame delays stayed around 9 ms at the 95th percentile. Timing varies by device and load. The main gains are less loading, saving, and copying work. Excalidraw is still the drawing engine.
