# Techniques

## T1 - Free Rectangle and Arrow Drawing

Use keyboard shortcuts to switch drawing modes:

- Press `r` to draw a rectangle freely anywhere on the canvas.
- Press `a` to draw an arrow freely anywhere on the canvas.
- Select a rectangle or arrow and press the macOS `Delete` key to remove it.

## T2 - Lightweight Page Switcher

Use a command palette to switch between Excalidraw-backed pages:

- Press `Command+K` to open the page switcher.
- Search filters the existing pages.
- Press `Enter` on a page result to switch to that page.
- Use the create option to create a new page and switch to it.
- Press `Escape` or click outside the palette to close it.

## T3 - Mermaid Diagram Images

Insert Mermaid diagrams as editable image elements on the canvas:

- Press `Command+K` and select "Insert Mermaid diagram" to open the Mermaid editor.
- Write Mermaid syntax on the left panel; a live preview renders on the right.
- Press `Cmd+Enter` or click "Insert →" to place the diagram on the canvas as an image.
- Double-click any Mermaid image on the canvas to re-open the editor and modify the diagram.
- The Mermaid source code is preserved, enabling round-trip editing.

## T4 - Default Image Insertion

Insert bundled default images from the command palette:

- Store bundled default images under `src/assets/default-images/`.
- Use one file per default image, such as `stick-user.svg`, `stick-admin.svg`, `database.svg`, `queue.svg`, `cache.svg`, `web-app.svg`, `mobile-app.svg`, and `object-storage-bucket.svg`.
- Keep searchable image metadata in app code, ideally `src/lib/defaultImages.ts`, with each image's id, label, search terms, asset path, MIME type, and default canvas size.
- Press `Command+K` to open the command palette.
- Search for terms such as `stick user`, `stick admin`, `database`, `queue`, `cache`, `web app`, `mobile app`, or `object storage bucket`.
- Matching default image results appear with an image icon and label.
- Press `Enter` on a default image result to insert it onto the canvas at the current cursor position.
- If no cursor position is available, insert the image at the current viewport center.
- Cache uses three stacked diamonds with dark lines in light mode and light lines in dark mode.
- Cache, Database, and Queue include their default names as centered text below the image.
- Account for empty space inside the artwork so Cache and Database names have the same visual gap as Queue.
- Group the image and name so they move together. Double-click the name to edit it with the canvas text editor.
- Keep edited names when saving, reloading, copying, or undoing and redoing changes.

## T5 - Auto Shape from Selection

Quickly create rectangles or arrows by dragging in selection mode:

- Drag an empty area of the canvas in selection mode (the default pointer).
- If your drag is long and thin (or strictly horizontal/vertical), it creates an Arrow.
- If your drag is wide and boxy, it creates a Rectangle.
- Very small drags (< 15px) are ignored to prevent accidental shape creation.
- If your drag intercepts and selects existing elements, no shape is created.

## T6 - Horizontal Connections from Right Edges

Create horizontal arrows by clicking an element's right edge:

- In selection mode, the whole right edge of a shape, text element, or image can be clicked.
- Show a thin blue highlight only while hovering over that edge.
- Start the arrow at the clicked point on the right edge. Do not move the start to the middle of the edge.
- Draw the arrow horizontally to the right at the same height as the click.
- End the arrow at the first element's left edge that intersects this horizontal path.
- Skip elements above or below the path, even if they are closer to the source.
- If no left edge intersects the path, create no arrow.
- Repeating the same connection creates no duplicate. Clicking at another height can create another arrow.
- Show no connection notifications or tooltips, including for missed or repeated clicks.
- Keep click positions correct after zooming, scrolling, or rotating an element.
- Use normal arrow bindings, undo, redo, and saving.

Implementation: `src/components/HorizontalConnectors.tsx` and `src/lib/horizontalConnections.ts`.
Workflow tests: `tests/t6.spec.ts`.

## T7 - Custom Keyboard Shortcuts

Keep all custom shortcuts in this spec:

| Where | Shortcut | Action |
| --- | --- | --- |
| Canvas | `r` | Draw a rectangle. |
| Canvas | `a` | Draw an arrow. |
| Canvas | `s` | Draw the bundled Stick User image. |
| Canvas | `d` | Draw the bundled Database image. |
| Canvas | `q` | Draw the bundled Queue image. |
| Canvas | `c` | Draw the bundled Cache image. |
| Canvas | `z` | Reset zoom to exactly 100%. |
| Anywhere in the app | `Command+K` or `Ctrl+K` | Open the page switcher. |
| Page switcher | `ArrowUp` / `ArrowDown` | Move between results. |
| Page switcher | `Enter` | Choose the highlighted result. |
| Page switcher | `Escape` | Close the page switcher. |
| Mermaid editor | `Command+Enter` or `Ctrl+Enter` | Insert or update the diagram. |
| Mermaid editor, Vim normal mode | `s` | Start Flash search and jump. |

- For `r`, `a`, `s`, `d`, `q`, and `c`, press the key, then drag on the canvas to place and size the element.
- `q` and `c` use the same image placement flow as `s` and `d`. `q` replaces the editor's default tool-lock shortcut. `c` replaces its ellipse shortcut.
- `z` acts like the Reset Zoom button. Both 50% and 200% become 100%. At 100%, zoom stays at 100%.
- Keep the same scene point at the viewport center when resetting zoom.
- Resetting zoom does not switch the active tool or change the selection.
- Ignore single-key canvas shortcuts while typing in text fields or editable content. Keep modified shortcuts such as undo working normally.
- Image placement supports cancellation, undo, redo, saving, and page changes.

Canvas shortcut implementation: `src/hooks/useCanvasShortcuts.ts`.
Workflow tests: `tests/t7.spec.ts`. Page switcher and Mermaid workflows also have tests in `tests/t2.spec.ts` and `tests/t3.spec.ts`.
