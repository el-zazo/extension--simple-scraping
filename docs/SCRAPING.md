# Scraping Engine Reference

> **Simple Web Scraper** Chrome Extension &mdash; v1.0.0 (Manifest V3)

This document provides a comprehensive reference for the scraping engine inside the Simple Web Scraper extension. It covers the decision flow, core extraction logic, multi-page and infinite-scroll strategies, deduplication, safe DOM queries, diagnostics, and the mechanism for stopping a running scrape. The engine lives primarily in `content/content.js` and runs as a content script injected into the target page.

---

## Table of Contents

- [Scraping Decision Flow](#scraping-decision-flow)
- [Page Scraping: scrapeCurrentPageDetailed](#page-scraping-scrapecurrentpagedetailed)
- [Value Extraction: extractValue](#value-extraction-extractvalue)
- [RegExp Post-Processing](#regexp-post-processing)
- [Multi-Page Scraping: startScrapingMultiPage](#multi-page-scraping-startscrapingmultipage)
- [Scrolling Scraping: startScrapingWithScrolling](#scrolling-scraping-startscrapingwithscrolling)
- [Deduplication](#deduplication)
- [Safe DOM Queries](#safe-dom-queries)
- [Diagnostics](#diagnostics)
- [Stopping Scraping](#stopping-scraping)

---

## Scraping Decision Flow

The entry point for every scrape is the `startScraping(schema)` function in `content/content.js`. When the sidebar sends a scraping request, this function acts as the central dispatcher, deciding which specialized scraping strategy to invoke based on the properties present in the schema object. Understanding this decision tree is essential because it determines the entire execution path and which sub-functions will handle the actual data extraction.

The decision flow proceeds through four sequential checks, and the first matching condition short-circuits the rest:

1. **Clear markers** — The very first action is always a call to `clearScrapedMarkers()`. This removes any `scraped="true"` attributes that may have been left on DOM elements from a prior scraping session. Clearing stale markers ensures a fresh start so that no legitimate data is accidentally skipped due to leftover deduplication state from a previous run.

2. **Check scrolling mode** — If `schema.enableScrolling` is truthy, the function immediately delegates to `startScrapingWithScrolling(schema)` and returns. Scrolling mode is designed for pages that lazy-load content as the user scrolls, such as infinite-scroll feeds or paginated lists that append new items on scroll. Because the scrolling strategy has its own loop that repeatedly calls the extraction logic, it takes precedence over all other modes.

3. **Check pagination** — If scrolling mode is not active, the function checks whether multi-page (pagination) scraping is needed. This is true when either `schema.maxPages > 1` or `schema.nextButtonSelector` is a non-empty string. If either condition holds, the function delegates to `startScrapingMultiPage(schema)`, which handles clicking a "next" button and scraping across multiple dynamically loaded pages.

4. **Single-page fallback** — If none of the above conditions match, the engine falls back to the simplest strategy: a single-page scrape. It calls `scrapeCurrentPageDetailed(schema)`, posts a `scrapingResults` message to the sidebar with the extracted data, and then posts a `scrapingDone` message. If an error occurs during extraction, it posts a `scrapingError` message instead.

---

## Page Scraping: scrapeCurrentPageDetailed

The `scrapeCurrentPageDetailed(schema)` function is the core extraction engine. It is called directly for single-page scraping and indirectly by both the multi-page and scrolling strategies. It returns an object `{ results, diagnostics }`, where `results` is an array of row objects and `diagnostics` is an array of descriptive strings that help the user understand what happened during extraction.

### Step 1: Determine Card Elements

The function first attempts to locate "card" elements — repeated DOM containers that each represent one data record (e.g., a product card, a search result item, a table row). The way cards are found depends on which selectors the schema provides:

- **Both `parentSelector` and `cardSelector` provided** — The engine first locates the parent container using `safeQuerySelector(parentSelector)`. Then, within that parent, it finds all card elements using `parent.querySelectorAll(cardSelector)`. This two-level approach is useful when the card selector alone might match elements outside the intended region of the page, such as navigation items or footer elements that happen to share the same class.

- **Only `cardSelector` provided** — The engine finds cards globally on the page using `safeQuerySelectorAll(cardSelector)`. This is the simplest and most common pattern, suitable when the card selector is specific enough to only match the desired data items.

- **Neither provided** — No card elements are located, and the engine proceeds to the non-card fallback strategies described below.

### Step 2: Card-Based Scraping (Cards Found)

When card elements are successfully found, the engine uses a card-based iteration strategy. This is the primary and most reliable scraping mode, because each card provides a scoped DOM subtree within which column selectors are evaluated, ensuring that column values are correctly associated with the right record.

The process works as follows:

1. **Filter already-scraped cards** — Any card element that already has the `scraped="true"` attribute is excluded from processing. This is the primary deduplication mechanism and is especially important during multi-page and scrolling scrapes, where the same DOM elements may be visible across multiple iterations.

2. **Iterate columns per card** — For each remaining card, the engine iterates over the `schema.columns` array. For each column, the extraction strategy depends on the `many_values` flag:
   - If `column.many_values` is true, the engine uses `card.querySelectorAll(column.selector)` to find ALL matching elements within the card, extracts values from each, filters out empty strings, and returns an array. This is useful for fields that can have multiple values per record, such as a list of tags or multiple image sources.
   - If `column.many_values` is false (or absent), the engine uses `card.querySelector(column.selector)` to find only the FIRST matching element within the card and extracts a single string value. This is the default behavior for most columns.

3. **Mark each card** — After extracting all column values from a card, the engine marks it with `scraped="true"`. This ensures the card will not be reprocessed in subsequent iterations of a scrolling or multi-page scrape.

4. **Push row data** — The extracted column values for each card are assembled into a row object and pushed onto the `results` array.

### Step 3: Non-Card Fallback (No Cards Found)

When no card elements are found — either because no selectors were provided or because the selectors matched nothing — the engine falls back to one of two alternative strategies. These strategies are less precise than card-based scraping because they lack a natural container boundary, but they can still produce useful results for pages with flat or irregularly structured content.

**Multiple Elements Fallback** — If at least one column in the schema has `multiple_elements: true`, the engine uses this strategy:

1. For every column, the engine finds matching elements using `safeQuerySelectorAll(column.selector)`.
2. The first column that is marked as `multiple_elements` becomes the "base column" for iteration. The number of elements found for this base column determines the number of rows that will be produced.
3. For each element in the base column (accessed by index):
   - The base column value is extracted from the element at that index.
   - Other columns that are also marked as `multiple_elements` extract their value from the element at the same index in their own result set. This creates a positional alignment between columns — the third element of column A is paired with the third element of column B.
   - Columns that are NOT marked as `multiple_elements` extract from the first matching element on the page, meaning the same value is shared across all rows. This is useful for fields like a page title or a category name that applies to every record.
4. A row object is pushed for each base column element.

**Single-Row Extraction** — If no columns are marked as `multiple_elements`, the engine uses the simplest possible strategy:

1. For each column, the engine finds the first matching element using `safeQuerySelector(column.selector)`.
2. The value is extracted from that element.
3. If ANY element was found across all columns, a single row is pushed containing all extracted values (with empty strings for columns whose selectors matched nothing). If NO elements were found at all — meaning every column selector failed to match — then zero rows are produced and the results array remains empty.

---

## Value Extraction: extractValue

The `extractValue(element, column)` function is responsible for pulling a value out of a single DOM element. It dispatches on the column's `type` property, which tells the engine what kind of data to extract. This design allows the same selector to yield very different results depending on the configured type — for example, an `<a>` element could yield its visible text (type `text`), its destination URL (type `href`), or a specific attribute like `data-id` (type `attribute`).

The supported types and their extraction methods are:

| Type | Extraction Method |
|------|-------------------|
| `text` | `element.textContent.trim()` — Returns the full visible text content of the element, including text from descendant nodes, with leading and trailing whitespace removed. |
| `html` | `element.innerHTML.trim()` — Returns the raw HTML markup inside the element as a string. Useful when the markup itself is the data, such as embedded tables or formatted content. |
| `attribute` | `element.getAttribute(column.attribute_name) \|\| ""` — Returns the value of the specified HTML attribute. The `attribute_name` property on the column configuration determines which attribute to read. Returns an empty string if the attribute does not exist. |
| `href` | `element.href \|\| ""` — Returns the fully resolved absolute URL from the element's `href` property. Unlike `getAttribute('href')`, which may return a relative path, `element.href` always provides the complete URL. |
| `src` | `element.src \|\| ""` — Returns the fully resolved absolute URL from the element's `src` property. Like `href`, this always provides the complete URL rather than a potentially relative attribute value. |
| `style` | `window.getComputedStyle(element).getPropertyValue(column.style_property).trim() \|\| ""` — Returns the computed value of the specified CSS property. The `style_property` on the column configuration determines which property to read. This reflects the element's actual rendered style, including inherited and computed values. |
| default | `element.textContent.trim()` — If the column type is unrecognized or not set, the engine falls back to plain text extraction, which is the most common and generally useful behavior. |

---

## RegExp Post-Processing

After the initial value extraction, the engine can optionally apply a regular expression to refine or transform the result. This feature is controlled by two column properties: `use_regexp` (a boolean flag) and `regexp_pattern` (the pattern string). RegExp post-processing is applied when `column.use_regexp` is `true` and `column.regexp_pattern` is a non-empty string.

The pattern can be specified in two formats:

1. **Literal format** — If the pattern matches the form `/pattern/flags` (e.g., `/price:\s*\$?(\d+\.?\d*)/gi`), the engine uses a regular expression to extract the pattern string and flags from between the slashes. It then creates the RegExp with `new RegExp(pattern, flags)`, where `pattern` is the content between the first and last slash, and `flags` is the optional suffix after the closing slash. Supported flags include `g` (global), `i` (case-insensitive), `m` (multiline), `u` (unicode), and `y` (sticky).

2. **Plain format** — If the pattern does not match the literal format, the engine treats the entire string as a plain regex pattern and creates `new RegExp(regexpPattern)` with no flags. This is simpler but does not allow flag customization.

Once the RegExp is constructed, it is matched against the previously extracted value:

- If the match succeeds and contains at least one captured group (parenthesized subexpression), the engine returns `match[1]` — the first captured group. This is the most common use case, where the pattern is designed to isolate a specific portion of the extracted text.
- If the match succeeds but contains no captured groups, the engine returns `match[0]` — the entire matched substring. This is useful when you want to confirm the presence of a pattern and extract the matching portion as-is.
- If the match fails (no match found), the engine returns the original extracted value unchanged. The regex is treated as a best-effort filter, not a mandatory requirement.
- If an error occurs during RegExp construction or matching (e.g., an invalid pattern), the engine logs the error and returns the original extracted value. Errors never crash the scraping process.

---

## Multi-Page Scraping: startScrapingMultiPage

The `startScrapingMultiPage(schema)` function is an async function that handles pagination-based scraping. It is designed for pages where data spans multiple views, each accessible by clicking a "next" button. Rather than navigating away from the page (which would destroy the content script), it relies on the target site being a single-page application (SPA) or using `pushState`/`replaceState` to update the URL and content dynamically.

The function proceeds as follows:

1. **Activate scraping** — It sets `scraper.scrapingActive = true`, which signals that a scrape is in progress and enables the stop mechanism.

2. **Calculate parameters** — It computes `maxPages` as `Math.max(1, parseInt(schema.maxPages || 1, 10))`, ensuring at least one page is scraped. It computes `delayMs` as `Math.max(0, parseInt(schema.nextDelayMs || 0, 10))`, which is the number of milliseconds to wait after clicking the next button before scraping the new content. This delay gives the page time to render updated content.

3. **Page iteration loop** — For each page index from 1 to `maxPages`:
   - **a.** Check if `scraper.scrapingActive` is still `true`. If it has been set to `false` (by the user clicking "Stop Scraping"), the loop breaks immediately.
   - **b.** Call `scrapeCurrentPageDetailed(schema)` to extract data from the current page state. This returns `{ results, diagnostics }`.
   - **c.** Post a `scrapingProgress` message to the sidebar containing `{ results, diagnostics, pageIndex, totalPages }`. This allows the sidebar to display intermediate results as each page is scraped.
   - **d.** If this is the last planned page (pageIndex equals maxPages), break out of the loop — there is no need to click the next button.
   - **e.** Attempt to find and click the next button using `safeQuerySelector(nextSelector)`. The selector comes from `schema.nextButtonSelector`.
   - **f.** If the next button is not found on the page, the loop breaks early. There are no more pages to scrape.
   - **g.** Wait `delayMs` milliseconds to allow the page to update its content after the click.

4. **Cleanup** — In the `finally` block, the function sets `scraper.scrapingActive = false` and posts a `scrapingDone` message to the sidebar. This ensures cleanup always happens, even if an error is thrown during the loop.

**Important note:** The content script never navigates away from the page. It clicks the next button and waits, assuming the page updates dynamically. If the target site performs a full page reload on pagination, the content script will be destroyed and the scrape will end prematurely. In such cases, the scrolling strategy or a different approach may be more appropriate.

---

## Scrolling Scraping: startScrapingWithScrolling

The `startScrapingWithScrolling(schema)` function is an async function designed for pages that load content incrementally as the user scrolls — commonly known as "infinite scroll" or "lazy load" pages. Instead of paginating by clicking buttons, this strategy scrolls the page downward by a fixed pixel amount, pausing after each scroll to let new content render, and then extracts data from newly appeared elements.

The function proceeds as follows:

1. **Activate scraping** — It sets `scraper.scrapingActive = true`.

2. **Calculate scroll parameters** — Three key parameters control the scrolling behavior:
   - `scrollByPx` — The number of pixels to scroll on each step. Computed as `Math.max(1, parseInt(schema.scrollByPx || 1000, 10))`. The minimum is 1 pixel, but the default is 1000 pixels, which typically moves the viewport by roughly one screen height.
   - `pauseMs` — The number of milliseconds to wait after each scroll step for new content to load. If `schema.scrollPauseMs` is 0 or NaN, it defaults to 1000 ms. Otherwise, it uses the provided value (minimum 0). This delay is critical for allowing AJAX requests and DOM rendering to complete before attempting extraction.
   - `maxSteps` — The maximum number of scroll steps to perform. If `schema.maxScrollSteps` is 0 or NaN, the engine auto-calculates it as `Math.ceil(document.body.scrollHeight / scrollByPx)`, which estimates the number of steps needed to scroll from the top to the bottom of the page. If a specific value is provided, it is used as-is.

3. **Scroll iteration loop** — For each step from 1 to `maxSteps`:
   - **a.** Check if `scraper.scrapingActive` is still `true`. If the user has stopped the scrape, break immediately.
   - **b.** Find card elements using the same logic as `scrapeCurrentPageDetailed`: if both `parentSelector` and `cardSelector` are provided, scope the search under the parent; if only `cardSelector` is provided, search globally.
   - **c.** Filter out cards that already have the `scraped="true"` attribute. Only new, previously unseen cards are processed in this step.
   - **d.** For each new card, extract column values using the same card-based extraction logic as `scrapeCurrentPageDetailed`. This includes support for `many_values` columns, value extraction by type, and optional RegExp post-processing.
   - **e.** Mark each processed card with `scraped="true"` to prevent re-extraction in subsequent scroll steps.
   - **f.** If any new results were found during this step, post a `scrapingProgress` message to the sidebar so the user can see intermediate results accumulating in real time.
   - **g.** Scroll the page by `scrollByPx` pixels using `window.scrollBy(0, scrollByPx)`.
   - **h.** Wait `pauseMs` milliseconds before proceeding to the next step.

4. **Cleanup** — In the `finally` block, the function sets `scraper.scrapingActive = false` and posts a `scrapingDone` message. This guarantees that the scraping state is properly reset and the sidebar is notified, even if an error occurs mid-scroll.

The scrolling strategy effectively treats the page as a stream of content, extracting data as it appears and continuing until the scroll reaches the bottom or the step limit is hit. The `scraped="true"` attribute ensures that even if the scroll causes previously visible cards to remain in the DOM, they are not re-extracted on subsequent iterations.

---

## Deduplication

The scraping engine uses a DOM-based deduplication system centered around the `scraped="true"` HTML attribute. This attribute is set on card elements after their data has been successfully extracted, and it serves as a persistent marker that persists across multiple iterations of the scraping loop. Understanding this mechanism is critical for anyone building schemas for multi-page or scrolling scrapes, because it directly affects which elements get processed and which are skipped.

The deduplication system works as follows:

- **Setting the marker** — After all column values have been extracted from a card element, the engine sets `scraped="true"` on that element. This is done unconditionally, regardless of whether any column values were actually found. The rationale is that if a card was visited and its selectors were evaluated, re-visiting it would produce the same (or worse) results, so it should be skipped.

- **Filtering on read** — Before processing cards, the engine filters out any that already carry the `scraped="true"` attribute. This happens in both the card-based path of `scrapeCurrentPageDetailed` and in each iteration of the scrolling loop. The filter is a simple attribute check: cards with the attribute are excluded from the set of elements to process.

- **Clearing markers** — The `clearScrapedMarkers()` function removes all `scraped="true"` attributes from the entire document. It is called at the very beginning of `startScraping(schema)`, before any scraping strategy is selected. This ensures that each new scraping session starts with a clean slate, regardless of the state left behind by a previous session. Without this step, a re-run would skip all previously scraped elements.

- **Selector generation safety** — The `generateSelector()` utility function, which produces CSS selectors for user-selected elements, explicitly excludes the `scraped` attribute from generated selectors. This means that when a user clicks on an element to create a selector, the presence of `scraped="true"` will not pollute the selector. Without this exclusion, generated selectors might include `[scraped="true"]` or similar fragments, which would break on a fresh scrape where the attribute has not yet been set.

---

## Safe DOM Queries

The scraping engine provides two wrapper functions — `safeQuerySelector(selector)` and `safeQuerySelectorAll(selector)` — that protect against crashes caused by invalid CSS selectors. Because the extension allows users to type custom selectors into the schema configuration, there is a real possibility that a selector will be syntactically invalid. A bare call to `document.querySelector` with an invalid selector throws a `DOMException`, which would crash the scraping loop and leave the engine in an inconsistent state.

- **`safeQuerySelector(selector)`** — Wraps `document.querySelector(selector)` in a try-catch block. If the selector is valid and an element is found, it returns that element. If the selector is valid but no element matches, it returns `null`. If the selector is invalid (e.g., `div >>`, `###bad`, or any string that does not conform to CSS selector syntax), the catch block intercepts the `DOMException` and returns `null`. This allows the calling code to treat "not found" and "invalid selector" identically, simplifying control flow.

- **`safeQuerySelectorAll(selector)`** — Wraps `document.querySelectorAll(selector)` in a try-catch block. If the selector is valid, it returns the resulting `NodeList` (or an empty array conversion for consistency). If the selector is invalid, the catch block returns an empty array, signaling that no elements were found. This is consistent with the contract of `querySelectorAll` — a valid selector that matches nothing also returns an empty result — so callers never need to distinguish between "no matches" and "bad selector."

These safe wrappers are used throughout the engine wherever a user-provided selector is evaluated: finding parent containers, locating card elements, resolving column selectors, and finding next-button elements. By centralizing error handling at this level, the engine avoids the need for defensive try-catch blocks at every call site, keeping the main logic clean and readable.

---

## Diagnostics

The diagnostics system provides real-time, human-readable feedback about what the scraping engine is doing at each stage of execution. Every call to `scrapeCurrentPageDetailed(schema)` returns a `diagnostics` array alongside the `results` array. The diagnostics are arrays of descriptive strings that explain the decisions made and the outcomes observed during extraction. They are posted to the sidebar alongside scraping progress messages, allowing users to understand why certain results were (or were not) produced.

The diagnostic messages cover the full lifecycle of a scrape:

- **Selector evaluation** — Messages indicate which selectors were provided and whether they matched elements. Examples include `"Parent selector provided."`, `"Parent selector not provided."`, `"Card selector provided."`, `"Card selector not provided."`, `"Parent element found."`, `"Parent element NOT found."`, and `"Card selector invalid under parent."`

- **Card counting** — Messages report how many cards were found and how many remain after filtering out already-scraped elements: `"Cards found: 5."`, `"Cards to process (excluding already scraped): 3."`

- **Strategy selection** — Messages indicate which scraping strategy was chosen: `"Using card-based scraping (iterate cards and query columns inside each card)."` or `"No cards found. Falling back to non-card scraping."`

- **Multiple-elements fallback** — When the non-card fallback is used, diagnostics report whether multiple-elements columns exist and which one serves as the base: `"Columns marked as multiple elements exist."`, `"No columns marked as multiple elements."`, `"Base column for iteration: Title (10 elements)."`, `"Rows produced via multiple-elements fallback: 10."`, `"No elements found for base multiple column. No rows produced."`

- **Single-row extraction** — For the simplest case: `"Single-row extraction produced 1 row."`, `"No elements found for any column in single extraction."`

- **Scrolling progress** — During scrolling scrapes, each step emits a diagnostic: `"Scrolling step 1/25. Visible cards: 8."`

These messages are invaluable for debugging schemas. If a scrape returns no results, the diagnostics will typically reveal whether a selector was invalid, no elements matched, or cards were filtered as already-scraped. Users can read these messages in the sidebar to iteratively refine their selectors without needing to open DevTools or inspect the DOM manually.

---

## Stopping Scraping

The scraping engine supports user-initiated cancellation through a cooperative stopping mechanism. Because JavaScript is single-threaded and the scraping loops use `async/await` (not Web Workers or separate threads), the engine cannot be interrupted mid-iteration. Instead, it checks a boolean flag at the start of each loop iteration and exits cleanly if the flag has been set to `false`.

The stopping mechanism works as follows:

- **UI trigger** — While a scrape is active, the "Start Scraping" button in the sidebar is replaced with a "Stop Scraping" button. When the user clicks this button, the sidebar sends a `stopScraping` message to the content script.

- **Flag setting** — Upon receiving the `stopScraping` message, the content script sets `scraper.scrapingActive = false`. This flag is shared state that the scraping loops check on every iteration.

- **Cooperative checking** — Both the multi-page loop and the scrolling loop check `scraper.scrapingActive` at the beginning of each iteration. If the flag is `false`, the loop breaks immediately, skipping any remaining pages or scroll steps. This means there may be a brief delay between clicking "Stop Scraping" and the scrape actually stopping — specifically, the engine will finish extracting data from the current page or scroll step before checking the flag again.

- **Guaranteed cleanup** — Both the multi-page and scrolling functions use a `finally` block to ensure that `scraper.scrapingActive` is set to `false` and a `scrapingDone` message is posted to the sidebar, regardless of how the loop exits — whether it completes normally, breaks early due to a stop request, or throws an error. This prevents the engine from getting stuck in an "active" state.

- **Sidebar deletion** — If the user deletes the sidebar while a scrape is running (by closing it or navigating away), this also stops scraping and deactivates any active selector mode. The content script listens for the sidebar removal event and performs the same cleanup: setting `scraper.scrapingActive = false` and releasing any other held state.

The cooperative stopping design is simple and reliable. It avoids the complexity of thread termination or message-based cancellation while still providing responsive user control. The main trade-off is that long-running extraction steps (e.g., a page with thousands of cards) may delay the stop by a few seconds, but in practice this is rarely noticeable.
