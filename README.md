# Simple Web Scraper

> A Chrome extension for web data scraping with schema management, element selection, and multi-page support.

**Version:** 1.0.0  
**Manifest Version:** 3

---

## Features

- **Sidebar UI** — A slide-in panel on the left side of the page for managing scraping schemas and viewing results.
- **Visual Element Selector** — Click the 🔍 picker button next to any CSS selector field, then hover over and click elements on the page to auto-generate selectors.
- **Schema Management** — Create, edit, delete, search, filter, and sort scraping schemas. Import and export schemas as JSON files.
- **Three Scraping Modes:**
  - **Single Page** — Scrape all matching elements on the current page.
  - **Multi-Page Pagination** — Click a "next" button and scrape across multiple pages.
  - **Scrolling (Infinite Scroll)** — Scroll down progressively to collect dynamically loaded items.
- **Rich Column Configuration** — Six extraction types (`text`, `html`, `attribute`, `href`, `src`, `style`), RegExp post-processing, multiple-elements mode, and many-values arrays.
- **Diagnostics Panel** — Real-time feedback during scraping showing selectors matched, cards found, and fallback behavior.
- **Results Export** — Export scraped data as CSV or JSON, with per-page filtering.
- **Dark / Light Theme** — Toggle between themes (defaults to dark). Preference is persisted.

---

## Installation

### Load as Unpacked Extension (Development)

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the root directory of this project (the folder containing `manifest.json`).
5. The extension icon will appear in the toolbar.

### Usage

1. Navigate to any web page you want to scrape.
2. Click the **Simple Web Scraper** icon in the Chrome toolbar.
3. The sidebar slides in from the left.
4. Click **Add Schema** to create a new scraping configuration.
5. Fill in the selectors (use the 🔍 picker to select elements visually).
6. Add columns for the data you want to extract.
7. Click **Save Schema**, then **Start Scraping**.
8. View results in the results modal, filter by page, and export as CSV or JSON.

---

## Permissions

| Permission   | Reason                                                                 |
|--------------|------------------------------------------------------------------------|
| `activeTab`  | Access the currently active tab to inject the sidebar and scrape data. |
| `storage`    | Persist schemas and theme preference in `chrome.storage.local`.        |
| `scripting`  | Programmatically inject the content script when it is not yet loaded.  |

---

## File Structure

```
extension/
├── manifest.json                 # Extension manifest (Manifest V3)
├── background/
│   └── background.js             # Service worker: icon click handler & script injection
├── content/
│   └── content.js                # Content script: sidebar injection, element selector, scraping engine
├── sidebar/
│   ├── sidebar.html              # Sidebar HTML (schema form, results modal, import dialog)
│   ├── sidebar.css               # Styles with light/dark CSS custom properties
│   ├── sidebar.js                # Re-export module (backward compatibility shim)
│   └── js/
│       ├── main.js               # App initialization & event wiring
│       ├── ui.js                 # UI rendering, theme toggle, event listeners
│       ├── schema-manager.js     # Schema CRUD, import/export, search & sort
│       ├── scraping.js           # Scraping orchestration (sidebar side)
│       ├── results.js            # Results display, pagination, CSV/JSON export
│       ├── storage.js            # Chrome storage.local helpers
│       └── utils.js              # UUID generator (RFC4122 v4)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Quick Start Example

1. **Open a product listing page** (e.g., an e-commerce category page).
2. **Click the extension icon** to open the sidebar.
3. **Create a schema:**
   - **Schema Name:** "Product List"
   - **Parent Selector:** `.products-container` (or use the 🔍 picker)
   - **Card Selector:** `.product-card`
4. **Add columns:**
   - `Title` — selector: `.product-title`, type: `text`
   - `Price` — selector: `.price`, type: `text`
   - `Image` — selector: `img`, type: `src`
   - `Link` — selector: `a`, type: `href`
5. **Save and click "Start Scraping"**.
6. **View results** and export as CSV or JSON.

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Extension architecture, message passing, module structure |
| [Schema Reference](docs/SCHEMA.md) | Complete schema and column configuration reference |
| [Scraping Engine](docs/SCRAPING.md) | Scraping modes, decision flow, value extraction, diagnostics |
| [Element Selector](docs/ELEMENT-SELECTOR.md) | Visual element picker, CSS selector generation algorithm |
| [Theming](docs/THEME.md) | CSS custom properties, theme variables, toggle mechanism |
| [Results & Export](docs/RESULTS.md) | Results data model, per-page filtering, CSV/JSON export |

---

## Development Notes

- The sidebar is loaded as an `<iframe>` injected by the content script. Communication between the content script and sidebar uses `window.postMessage`.
- The background service worker uses `chrome.scripting.executeScript` to inject the content script on-demand if it was not loaded automatically (e.g., after a browser restart).
- State is stored in `window.simpleScraper` on the page to prevent redeclaration issues when the content script is injected multiple times.
- Schema IDs and column IDs are UUIDs generated with `crypto.getRandomValues`.
- All scraped cards are marked with a `scraped="true"` attribute to prevent duplicate extraction across steps and runs. These markers are cleared at the start of each new scraping session.
