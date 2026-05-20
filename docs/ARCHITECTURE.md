# Simple Web Scraper — Technical Architecture

**Extension Name:** Simple Web Scraper
**Version:** 1.0.0
**Manifest Version:** V3
**Minimum Chrome Version:** 88 (Manifest V3 required)

---

## 1. Extension Architecture Overview

Simple Web Scraper is a Chrome extension built on the Manifest V3 platform that provides in-page web scraping capabilities through an intuitive sidebar interface. The extension follows a three-component architecture that cleanly separates concerns between lifecycle management, page interaction, and user interface rendering. The first component is the **Background Service Worker** (`background/background.js`), which serves as the extension's event hub. It listens for browser action clicks (the extension icon in the toolbar) and orchestrates the injection and communication flow with content scripts. Because Manifest V3 replaces persistent background pages with service workers, the background script is stateless between events and must re-establish context on each activation. It handles the critical bootstrapping sequence: detecting whether the content script is already loaded on the target tab, conditionally injecting it if absent, and dispatching toggle commands once readiness is confirmed.

The second component is the **Content Script** (`content/content.js`), declared in the manifest to run on `<all_urls>`. This script is the workhorse of the extension — it manages sidebar injection by creating an iframe element dynamically in the host page's DOM, controls the element selector mode that allows users to visually pick DOM elements for scraping, and runs the full scraping engine that traverses the page extracting data according to user-defined schemas. To prevent redeclaration errors when the content script is injected multiple times into the same page (which can happen if the user clicks the extension icon repeatedly), the script attaches all its state to `window.simpleScraper` as a namespace guard. If this global already exists, the script skips initialization and simply re-uses the existing state. The content script's state object tracks the sidebar iframe reference, injection status, selector mode flag, target selector index, the currently highlighted element, and the original CSS properties (border, background, outline) of that element so they can be restored after highlighting.

The third component is the **Sidebar**, rendered as an iframe loaded from `sidebar/sidebar.html`. This separation into an iframe provides both CSS isolation from the host page and a dedicated document context for the extension's UI. The sidebar's JavaScript is organized into ES modules under `sidebar/js/`, each responsible for a distinct domain: initialization and wiring, DOM rendering, schema management, scraping coordination, results display, storage abstraction, and utility functions. This modular design keeps the sidebar's codebase maintainable and testable despite running entirely within the constrained iframe context.

---

## 2. Message Passing

Message passing is the communication backbone of Simple Web Scraper, and the extension employs two distinct mechanisms depending on the communication direction and the components involved. Understanding these patterns is essential for debugging, extending, or maintaining the extension, as every user interaction and data flow traverses one of these channels.

### 2.1 Background → Content Script

The background service worker communicates with the content script using `chrome.tabs.sendMessage`, the standard Chrome extension messaging API for sending messages from extension pages or service workers to content scripts running in a specific tab. This API requires the tab ID, which the background script obtains from the `chrome.action.onClicked` callback's `tab` parameter. Two message types traverse this channel. The `toggleSidebar` message instructs the content script to show or hide the sidebar iframe, injecting it first if it has not yet been created. The `ping` message serves as a lightweight liveness check — the content script responds with `{ success: true }` to confirm it is loaded and listening. The ping mechanism is not currently used in the main toggle flow (which relies on `chrome.runtime.lastError` detection instead), but it provides a clean API for future extensions such as health checks or multi-tab orchestration.

### 2.2 Content Script → Background

The content script sends messages back to the background using `chrome.runtime.sendMessage`. The sole message type in this direction is `contentScriptReady`, which the content script dispatches immediately after completing its `initialize()` function. This message is critical to the injection flow because the background script registers a one-time listener for it before calling `chrome.scripting.executeScript`. Without this handshake, the background would have no way to know when the content script has finished setting up and is ready to receive commands, leading to race conditions where `toggleSidebar` might arrive before the listener is registered.

### 2.3 Sidebar → Content Script

Communication from the sidebar iframe to the content script uses `window.postMessage` directed at `window.parent`. Because the sidebar is injected as an iframe within the host page, its `window.parent` points to the host page's window, where the content script's `message` event listener is registered. This approach is necessary because Chrome extension messaging (`chrome.runtime.sendMessage` / `chrome.tabs.sendMessage`) is not directly available between a sidebar iframe and a content script — they share the same extension origin but exist in different browsing contexts. The message types in this direction include: `closeSidebar`, which animates the sidebar out of view and sets its display to none without removing it from the DOM; `deleteSidebar`, which completely removes the iframe and resets all content script state; `startScraping`, which initiates the scraping engine with a schema payload containing the CSS selectors and field definitions; `stopScraping`, which halts the scraping loop by setting `scraper.scrapingActive` to false; and `activateElementSelector`, which puts the content script into element picker mode with a specified `targetIndex` indicating which schema field the user is selecting an element for.

### 2.4 Content Script → Sidebar

Messages from the content script to the sidebar also use `window.postMessage`, but directed at `scraper.sidebar.contentWindow` — the window object of the sidebar iframe. This allows the content script to push data into the sidebar without the sidebar needing to poll. The message types include: `elementSelected`, sent when the user clicks an element while in selector mode, carrying the computed CSS selector string and the target field index; `scrapingResults`, delivering the complete results of a single-page scrape along with diagnostic information; `scrapingProgress`, providing incremental results as each page in a multi-page scrape completes, including the current `pageIndex` and `totalPages` count; `scrapingDone`, a terminal signal indicating the scraping operation has finished with no payload; and `scrapingError`, carrying an error message string when something goes wrong during scraping. The sidebar validates all incoming messages by checking that the origin is either `window.parent` (for the host page context) or matches the extension's own origin via `chrome.runtime.getURL`, preventing malicious pages from injecting fake messages.

---

## 3. Sidebar Module Structure

The sidebar's JavaScript is decomposed into seven ES modules, each occupying a single file under `sidebar/js/`. This modular architecture enforces single-responsibility principles and makes the codebase navigable despite the sidebar's broad feature set. All modules are loaded via `import` statements in `main.js`, which acts as the composition root.

| Module | File | Responsibility |
|--------|------|----------------|
| main.js | `sidebar/js/main.js` | App initialization, imports all modules, wires event handlers, sets up import/export listeners |
| ui.js | `sidebar/js/ui.js` | DOM rendering, theme toggle, event listener setup, schema card creation, form data extraction, element selected handler |
| schema-manager.js | `sidebar/js/schema-manager.js` | Schema CRUD, search/filter/sort, import/export with duplicate handling (skip/replace/keep-both), element selector activation |
| scraping.js | `sidebar/js/scraping.js` | Receives scraping results/errors/progress/done from content script, delegates to results manager |
| results.js | `sidebar/js/results.js` | Results display, per-page filtering with checkboxes, diagnostics rendering, CSV/JSON export |
| storage.js | `sidebar/js/storage.js` | Generic `get`/`set` wrappers for `chrome.storage.local`, `loadSchemas`/`saveSchemas` helpers |
| utils.js | `sidebar/js/utils.js` | `uuidv4()` — RFC4122 v4 UUID generation using `crypto.getRandomValues` |

**main.js** serves as the application's entry point and composition root. It imports all other modules, initializes the sidebar's state, attaches the `message` event listener for incoming postMessage communication from the content script, and wires up DOM event handlers for buttons and forms. It also coordinates the import and export workflows, ensuring that file input events trigger schema import through the schema manager and that export buttons delegate to the results manager for data serialization.

**ui.js** is the largest module by responsibility, handling all direct DOM manipulation within the sidebar. It renders the initial sidebar structure, manages the theme toggle between light and dark modes, creates schema cards that display each saved scraping configuration, extracts form data when the user edits or creates a schema, and processes `elementSelected` messages by updating the relevant schema field with the chosen CSS selector. The module ensures that the sidebar remains responsive and visually consistent regardless of the host page's styling, leveraging the iframe's isolated document context.

**schema-manager.js** manages the full lifecycle of scraping schemas — the data structures that define which CSS selectors map to which output fields. It supports creation, reading, updating, and deletion of schemas, along with search, filter, and sort operations for managing large schema collections. Its import/export feature includes sophisticated duplicate detection: when importing schemas that already exist, the user can choose to skip the duplicate, replace the existing schema, or keep both copies. The module also handles activating the element selector for a specific schema field by sending the `activateElementSelector` message to the content script.

**scraping.js** acts as the messaging bridge for scraping operations. It listens for `scrapingResults`, `scrapingProgress`, `scrapingDone`, and `scrapingError` messages from the content script and delegates the data to the results manager for rendering. It also handles the `startScraping` and `stopScraping` user interactions, posting the corresponding messages to the content script. This thin coordination layer keeps scraping concerns separate from both the UI rendering and the schema management.

**results.js** is responsible for presenting scraping results to the user. It renders result tables, supports per-page filtering via checkboxes (allowing users to include or exclude individual pages from a multi-page scrape), displays diagnostic information such as missing fields or selector failures, and provides CSV and JSON export functionality. The export functions construct downloadable files in-memory and trigger browser downloads, keeping the entire export process client-side with no server dependency.

**storage.js** provides a thin abstraction layer over `chrome.storage.local`. Its generic `get` and `set` methods wrap the Chrome storage API's callback-based interface, and it exposes dedicated `loadSchemas` and `saveSchemas` helpers that serialize and deserialize the schema array to and from the `schemas` storage key. This abstraction insulates the rest of the sidebar code from the specifics of Chrome's storage API and provides a single point of change if the storage backend ever needs to be swapped or extended.

**utils.js** is a minimal utility module containing a single exported function: `uuidv4()`. This function generates RFC 4122 version 4 UUIDs using the Web Crypto API's `crypto.getRandomValues` method, providing cryptographically random identifiers for schema entries. The use of the Web Crypto API ensures uniform distribution across the UUID bit space, avoiding the bias that can arise from `Math.random()`-based implementations.

---

## 4. State Management

State in Simple Web Scraper is distributed across three layers, each with distinct lifecycle characteristics, persistence guarantees, and access patterns. This layered approach reflects the extension's component architecture and the constraints imposed by Manifest V3's service worker model.

### 4.1 Page-Level State

The content script maintains its state on `window.simpleScraper`, a global namespace attached to the host page's window object. This namespace serves a dual purpose: it holds all mutable state and acts as a redeclaration guard. When the content script is injected into a page (either automatically via the manifest's content_scripts declaration or programmatically via `chrome.scripting.executeScript`), it first checks whether `window.simpleScraper` already exists. If it does, the script skips initialization entirely, avoiding duplicate event listeners, duplicate iframes, and conflicting state. The properties tracked at this level include: the `sidebar` reference (the iframe DOM element), `sidebarInjected` boolean, `selectorMode` flag indicating whether the element picker is active, `targetSelectorIndex` identifying which schema field the user is currently selecting an element for, `highlightedElement` holding the currently highlighted DOM node, `originalBorder`, `originalBackground`, and `originalOutline` preserving the element's pre-highlight styles for restoration, and `scrapingActive` flag controlling the scraping loop. All of this state is ephemeral — it exists only for the lifetime of the page session and is destroyed when the tab is closed or navigated away.

### 4.2 Sidebar Module State

Within the sidebar iframe, each module manages its own slice of state through JavaScript module-scoped variables (closures over `let` and `const` declarations at the top level of each module file). The UI module tracks the current theme preference and DOM references; the schema manager maintains the schema list array, the ID of the schema currently being edited, an edit mode flag, and filter/sort settings; the results manager holds the results pages array and per-page selection state. Because these modules run inside an iframe with its own JavaScript context, their state is isolated from both the host page and other extension components. This state is also ephemeral at the module level — if the sidebar iframe is removed and re-created, all module state is reset to initial values and must be reconstructed from persistent storage.

### 4.3 Persistent Storage

Long-lived data is persisted through `chrome.storage.local`, a key-value store provided by the Chrome extension API that survives page reloads, tab closures, and browser restarts. The extension uses two storage keys: `schemas`, which holds a serialized array of schema objects (each containing a UUID, name, field definitions with CSS selectors, and metadata), and `simple_scraper_theme`, which stores the user's theme preference as either the string `"light"` or `"dark"`. The storage module's `loadSchemas` function reads and deserializes the `schemas` key on sidebar initialization, while `saveSchemas` serializes and writes the current schema array after any modification. Theme changes are similarly persisted immediately so that the preference survives across sessions. Because `chrome.storage.local` is asynchronous, all reads and writes use callback-based patterns (or could be wrapped in promises), and the sidebar's initialization sequence must await schema loading before rendering the UI.

---

## 5. Sidebar Injection Details

The sidebar is injected into the host page as a dynamically created `<iframe>` element with the ID `simple-scraper-sidebar`. This approach provides strong CSS and JavaScript isolation — the sidebar's styles cannot leak into or be affected by the host page's stylesheets, and the sidebar's JavaScript runs in its own execution context with its own global object. The iframe's source is set to the extension's `sidebar/sidebar.html` file, resolved through `chrome.runtime.getURL` to produce a `chrome-extension://` URL that the browser treats as a first-party extension resource.

The sidebar's positioning and animation are carefully designed to feel native and non-disruptive. It is fixed to the left edge of the viewport (`left: 0`, `top: 0`) with a width of 450 pixels and 100% height, ensuring it occupies a consistent vertical strip regardless of the host page's layout. A `z-index` of 100,000,000 places it above virtually any content the host page might render. The transition between visible and hidden states uses a `transform` + `opacity` animation with a 0.3-second duration and a `cubic-bezier(0.4, 0, 0.2, 1)` easing function — this is Material Design's standard easing curve, which produces a smooth deceleration that feels natural and polished. When the sidebar is hidden, it is translated 450 pixels to the left (`translateX(-450px)`) and faded to zero opacity, then set to `display: none` to remove it from the layout entirely. When shown, it slides back to `translateX(0)` with full opacity and `display: block`. The two-step hide sequence (first animate, then set display:none) is important because CSS transitions do not animate `display` properties, so the display change must follow the animation rather than accompany it.

On first injection, the sidebar is created and immediately opened with no user delay. This is because the initial injection is always triggered by a deliberate user action (clicking the extension icon), so showing the sidebar immediately provides responsive feedback. Subsequent toggles simply show or hide the already-injected iframe, avoiding the overhead of re-creating the DOM element and re-loading the sidebar's HTML, CSS, and JavaScript modules.

---

## 6. Content Script Injection Flow

The content script injection flow is one of the most critical sequences in the extension, as it must handle the inherent asynchrony between the background service worker, the content script, and the sidebar iframe. The flow is triggered each time the user clicks the extension's browser action icon, and it must gracefully handle both the case where the content script is already loaded and the case where it must be injected fresh.

**Step 1: User clicks extension icon.** The browser fires the `chrome.action.onClicked` event in the background service worker, passing the active tab's metadata including its `tab.id`. This event only fires if the extension has not defined a popup (which Simple Web Scraper has not), making it the primary entry point for user interaction.

**Step 2: Background sends toggle command.** The background service worker immediately attempts to send a `toggleSidebar` message to the content script using `chrome.tabs.sendMessage` with the tab's ID. This is the optimistic path — if the content script is already loaded (because the manifest declares it for `<all_urls>` and the page has finished loading), the message is delivered directly and the content script toggles the sidebar.

**Step 3: Error handling and conditional injection.** If the content script is not yet loaded — which can happen if the page is still loading, if the manifest's content script match pattern does not cover the current URL, or if the script was unloaded for any reason — `chrome.tabs.sendMessage` invokes its callback with `chrome.runtime.lastError` set. The background script detects this error and enters the injection path.

**Step 4: Ready listener registration.** Before injecting the content script, the background registers a one-time listener for the `contentScriptReady` message using `chrome.runtime.onMessage.addListener`. This listener is wrapped in a self-removing closure so it fires exactly once and then detaches, preventing memory leaks in the service worker.

**Step 5: Script injection.** The background calls `chrome.scripting.executeScript` with the target tab ID and the content script's file path. Chrome loads and executes the script in the tab's main world context. The content script's top-level code runs, checks for the `window.simpleScraper` guard, and if absent, calls `initialize()` to set up all state, event listeners, and the message handler.

**Step 6: Ready signal and toggle dispatch.** After `initialize()` completes, the content script sends a `contentScriptReady` message via `chrome.runtime.sendMessage`. The background's ready listener receives this, and immediately sends the `toggleSidebar` command via `chrome.tabs.sendMessage`. The content script receives this command, creates the sidebar iframe, and opens it with the slide-in animation.

This six-step flow ensures that regardless of the content script's initial state, the user always sees a responsive toggle behavior when clicking the extension icon. The handshake mechanism prevents the race condition where a toggle command could arrive before the content script has finished initializing.

---

## 7. Delete Sidebar Flow

The delete sidebar flow is triggered when the user clicks the × (close/delete) button within the sidebar UI. Unlike the simple toggle flow — which merely hides the sidebar by sliding it off-screen — the delete flow performs a full teardown that removes the sidebar from the DOM entirely and resets all associated state in the content script. This is important for freeing memory, cleaning up event listeners, and ensuring a clean slate for the next time the user opens the sidebar.

**Step 1: User clicks the × button.** The sidebar's UI module captures the click event on the delete button and sends a `deleteSidebar` message to the content script via `window.postMessage` targeting `window.parent`. This message contains no payload — the instruction is unambiguous.

**Step 2: Content script stops active scraping.** The content script's message handler receives the `deleteSidebar` message and immediately checks whether `scraper.scrapingActive` is true. If a scraping operation is in progress, it sets the flag to false, which causes the scraping loop to exit on its next iteration. This prevents orphaned scraping operations from continuing to run after the sidebar — their primary communication channel — has been removed.

**Step 3: Element selector deactivation.** If the element selector mode is active (`scraper.selectorMode` is true), the content script deactivates it. This involves removing the highlight styles from the currently selected element (restoring its original `border`, `background`, and `outline` properties from the saved originals), resetting `selectorMode` to false, and clearing `targetSelectorIndex` and `highlightedElement`. Without this cleanup, the host page could be left in a visually corrupted state with a highlighted element that the user can no longer interact with through the (now-removed) sidebar.

**Step 4: Event listener removal.** The content script removes its `message` event listener from the `window` object. This is critical for preventing memory leaks and ghost handlers. If the listener were not removed before the sidebar is deleted, a subsequent sidebar injection would add a new listener while the old one remains, causing messages to be processed twice and leading to unpredictable behavior such as duplicate result rendering or double toggle actions.

**Step 5: Iframe DOM removal.** The content script removes the sidebar iframe element from the host page's DOM by calling `scraper.sidebar.remove()` (or the equivalent `parentNode.removeChild`). This immediately destroys the iframe's browsing context, unloading the sidebar's HTML, CSS, and JavaScript, and freeing the memory associated with the sidebar's DOM tree and JavaScript heap.

**Step 6: State reset.** Finally, the content script resets its internal state: `scraper.sidebar` is set to `null` and `scraper.sidebarInjected` is set to `false`. This ensures that the next time the user clicks the extension icon, the toggle flow will detect that the sidebar needs to be re-created and will go through the full injection path rather than attempting to show a non-existent iframe. The remaining state properties (selector mode, scraping active, etc.) are already cleared by the preceding steps, leaving the content script in a clean initial state.
