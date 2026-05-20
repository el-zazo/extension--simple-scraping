# Simple Web Scraper — Results & Export Reference

> **Extension Version:** 1.0.0 | **Manifest Version:** V3 | **Document Version:** 1.0

---

## Overview

The Results module, implemented in `sidebar/js/results.js`, is the central hub for displaying, filtering, diagnosing, and exporting the data that the Simple Web Scraper extracts from web pages. Once a scraping operation begins—whether it targets a single page or spans multiple pages through pagination or infinite scrolling—the results module takes responsibility for rendering every piece of collected data in a structured, interactive table that supports horizontal scrolling for wide datasets. Beyond simple display, the module provides a per-page filtering mechanism that allows users to isolate the output from specific scraping steps, a diagnostics panel that surfaces warnings and informational messages about the scraping process, and two export formats (CSV and JSON) that transform the in-memory data into downloadable files suitable for downstream processing in spreadsheet applications, data pipelines, or custom scripts.

The results are presented in a modal overlay (`#results-modal`) that sits on top of the sidebar content, giving the data maximum screen real estate while maintaining access to the close/back controls. The modal design was chosen deliberately over an inline panel: scraping results frequently contain many columns and rows that benefit from the full width of the sidebar, and a modal overlay avoids the complexity of managing scroll containers within an already-scrolling sidebar. The results module is tightly integrated with the scraping pipeline—it receives progress updates in real time, supports progressive rendering as pages complete, and automatically opens the results view when scraping starts so that users can monitor data as it arrives.

---

## Data Model

The results module maintains its state using two module-level variables that together represent the complete scraping output. Understanding this data model is essential for anyone extending the results functionality, writing custom export formats, or debugging issues with data display.

```typescript
interface Page {
  index: number;          // Page/step number (1-based)
  items: Object[];        // Array of row objects (key = column name, value = extracted data)
  diagnostics: string[];  // Array of diagnostic messages for this page
}

// Module state
let pages: Page[] = [];
let totalPagesPlanned: number = 1;
```

The `Page` interface is the fundamental unit of organization. Each `Page` object represents a discrete step in the scraping process—this could be a literal page of search results, a single step in a multi-step navigation flow, or one iteration of an infinite-scrolling page. The `index` field is a 1-based integer that determines the display order of pages in the filtering dropdown and the grouping of diagnostics. The `items` array holds the actual extracted data: each object in the array represents one row of results, where the keys correspond to column names (as defined by the scraping schema) and the values are the extracted data. Values can be strings, numbers, or arrays—the latter occurring when a column is configured with `many_values: true`, indicating that multiple values may be extracted from a single row. The `diagnostics` array captures informational messages, warnings, and error descriptions generated during the scraping of that particular page, providing transparency into the scraper's behavior.

The module-level `pages` array is the authoritative store of all scraped data. It is initially empty and grows as scraping progresses. Each time a `scrapingProgress` message arrives from the content script, the corresponding page is either added to the array (if its index has not been seen before) or replaced (if a page with the same index already exists, which can happen when a page is re-scraped or updated). After each addition or replacement, the array is sorted by the `index` field to guarantee consistent ordering regardless of the arrival sequence of progress messages. The `totalPagesPlanned` variable tracks the expected total number of pages, which is used to populate the page filter dropdown with the correct number of checkboxes and to determine when all pages have been received.

---

## Results View

The results view is displayed as a modal overlay rendered by the `#results-modal` element. When the modal is activated, it covers the entire sidebar content area, providing an unobstructed view of the scraped data. The modal was designed to be the primary interface for reviewing scraping output, and its layout prioritizes data density and readability. The modal contains three main sections stacked vertically: a header with export and page-control buttons, a diagnostics panel, and the results table. The header bar is fixed at the top of the modal and includes the "Back" button (which closes the modal and returns to the sidebar), the export dropdown (CSV and JSON options), and the pages dropdown for per-page filtering.

The modal can be dismissed in two ways: by clicking the "Back" button in the header, or by clicking outside the modal content area (i.e., on the semi-transparent backdrop that covers the underlying sidebar). Both dismissal methods trigger the `hideResultsView()` function, which clears the `pages` array, resets `totalPagesPlanned` to 1, and hides the modal element. This destructive reset is intentional—once the user closes the results view, the scraped data is discarded from memory, ensuring that stale data from a previous scraping session does not contaminate the results of a future session. If users wish to preserve the data before closing the view, they must export it to CSV or JSON first.

The results view is shown proactively when scraping begins. The `schema-manager.startScraping()` function calls `showResultsView()` immediately after initiating the scrape, rather than waiting for the first results to arrive. This design decision ensures that users see the results container from the very beginning of the operation, which provides visual confirmation that the scrape has started and creates a container into which progressive results can be rendered as they arrive. The empty state of the results view displays a blank table with a "No pages yet" placeholder in the pages dropdown, making it clear that the view is active but waiting for data.

---

## Results Table

The results table is the primary data display component within the results view modal. It is rendered as a standard HTML `<table>` element with three structural layers: a `<thead>` for column headers, a `<tbody>` for data rows, and a wrapping container that enables horizontal scrolling for datasets that exceed the modal width. The table is rebuilt from scratch each time the data changes (when a new progress message arrives or when the page filter selection is modified), using a straightforward rendering approach that prioritizes correctness and simplicity over incremental DOM updates.

Column headers are derived dynamically from the keys of the first result object in the currently visible dataset. This means that the table schema is entirely data-driven—the results module does not hardcode any column names or assume a particular data structure. A special row-number column (`#`) is always prepended as the first column, displaying a sequential integer for each visible row. This row number provides a stable reference point that remains consistent regardless of filtering or sorting operations, making it easy for users to discuss specific rows when sharing results with colleagues or filing bug reports.

Array values—which occur when a column is configured with `many_values: true`—are rendered as bullet lists within their table cells. Each item in the array is prefixed with `- ` (dash and space) and placed on its own line. The cell's CSS `white-space` property is set to `pre-wrap`, which preserves line breaks and spaces while allowing the text to wrap to fit the column width. This rendering approach makes multi-value cells easy to scan visually, with each value on its own line, while still allowing the cell to expand vertically as needed. Empty values (empty strings, `null`, or `undefined`) are rendered as empty cells with no content, maintaining the table's structural integrity without introducing visual noise such as placeholder text or dash characters.

The table supports horizontal scrolling through a CSS `overflow-x: auto` container, which is essential for wide datasets with many columns. When the total column width exceeds the available modal width, a horizontal scrollbar appears automatically, allowing users to pan across the full dataset without any column truncation. The row-number column is not sticky—it scrolls horizontally with the rest of the table—but the table header row is fixed vertically via `position: sticky; top: 0` so that column names remain visible as the user scrolls through many rows of data.

---

## Per-Page Filtering

The per-page filtering system allows users to selectively display data from specific scraping steps while hiding others. This feature is essential for multi-page scraping operations where the user may want to inspect results from a particular page without the visual clutter of all pages combined, or where different pages may have different column schemas that would create an awkward merged table. The filter is controlled through a dropdown button labeled "Pages" in the results header bar.

When the dropdown is opened, it displays a checkbox for each page in the `pages` array, formatted as `☐ Page 1`, `☐ Page 2`, etc. All checkboxes are checked by default, meaning that all pages are visible when the results view first opens or when a new scraping session begins. Each checkbox directly controls the visibility of its corresponding page's data in the results table and diagnostics panel—checking a box includes that page's items in the displayed dataset, while unchecking it excludes them. The filtering is applied immediately upon any checkbox change: the results table is cleared and re-rendered using only the items from selected pages, and the diagnostics panel is similarly updated to show only the diagnostics from selected pages.

A "Select All" / "Deselect All" toggle button is provided at the top of the dropdown for convenience. The button's label is dynamic, changing based on the current state of the checkboxes. If every checkbox is currently checked, the label reads "Deselect All," indicating that clicking it will uncheck all pages. If any checkbox is unchecked—even just one—the label reads "Select All," indicating that clicking it will check all pages. This binary logic is simple and predictable: the button always performs the action that its label describes, and the label always describes the action that will move the system toward the opposite of the current "all checked" or "not all checked" state.

When no pages are available yet (i.e., the scraping has just started and no progress messages have been received), the dropdown displays a disabled placeholder item reading "No pages yet." This placeholder cannot be clicked or toggled—it exists solely to communicate the empty state to the user. The dropdown container has a `max-height` of 240px with `overflow-y: auto`, ensuring that scraping operations with many pages (e.g., a 50-page pagination scrape) do not produce an unmanageably tall dropdown. When the number of pages exceeds the visible area, a vertical scrollbar appears within the dropdown, allowing the user to access any page checkbox without scrolling the entire page.

---

## Diagnostics Panel

The diagnostics panel is rendered in the `#results-diagnostics-container` element, positioned above the results table within the modal. Its purpose is to surface informational messages, warnings, and errors that occurred during the scraping process, giving users visibility into the scraper's behavior and helping them diagnose issues such as missing selectors, empty results, or unexpected page structures. The panel is headed by a "Scraping Diagnostics" heading that clearly labels its content and distinguishes it from the data table below.

The rendering format depends on whether the results contain a single page or multiple pages. For single-page results, the diagnostics panel displays a flat list of diagnostic messages, each rendered as a separate line or bullet point. This simple format is appropriate when there is only one set of diagnostics to show, as grouping would add unnecessary visual hierarchy. For multi-page results, the diagnostics are organized under page headings (e.g., "Page 1", "Page 2"), with each heading followed by the list of diagnostic messages for that page. This grouping makes it easy to correlate diagnostic messages with the specific scraping step that produced them, which is critical for debugging multi-page operations where different pages may encounter different issues.

The diagnostics panel respects the per-page filter: only diagnostics from currently selected pages are displayed. If the user deselects Page 2 in the pages dropdown, the "Page 2" heading and all of its diagnostic messages are removed from the panel. This filtering behavior is consistent with the results table and ensures that the diagnostics panel always reflects the same subset of data that the user is viewing in the table. When diagnostics are re-rendered due to a filter change, the panel is completely cleared and rebuilt to prevent stale or duplicate messages from accumulating.

If no diagnostics are available for the currently selected pages (either because no diagnostics were generated or because all pages with diagnostics have been deselected), the panel displays the message "No diagnostics available." This placeholder prevents the panel from appearing empty or collapsed, which could confuse users into thinking that diagnostics are loading or that the panel is broken. The message clearly communicates that the absence of diagnostics is expected and intentional, not an error condition.

---

## CSV Export

The CSV export feature transforms the currently visible (filtered) results data into a comma-separated values file and downloads it to the user's default download directory. The export is triggered by clicking the "Export → CSV" button in the results header, which invokes the CSV generation and download logic. The export respects the per-page filter: only data from currently selected pages is included in the exported file. This means that users can use the page filter to export a subset of their results—for example, exporting only Page 3 data while excluding all other pages—without having to modify the scraping configuration or re-run the scrape.

If no results are available when the export button is clicked (i.e., the `pages` array is empty or all pages have been deselected), the export function displays a browser alert with the message "No results to export." This prevents the creation of empty or malformed CSV files that could cause errors when opened in spreadsheet applications. The alert is a simple, synchronous browser dialog that blocks further execution until the user dismisses it, ensuring that the user is aware that the export did not occur.

The CSV format follows standard conventions for maximum compatibility with spreadsheet applications (Microsoft Excel, Google Sheets, LibreOffice Calc) and data processing tools (Python's `csv` module, `pandas.read_csv`, command-line tools like `awk` and `cut`). The header row contains the column names, each quoted if the name contains commas, semicolons, newlines, or double-quote characters. Data rows follow the same quoting rules for individual values. Double-quote characters within values are escaped by doubling them (i.e., `"` becomes `""`), which is the standard CSV escaping convention. Columns are separated by commas. Array values (from `many_values` columns) are flattened into a single string by joining the array elements with `"; "` (semicolon and space), which produces a compact, readable representation that does not break the CSV column structure. For example, an array `["Apple", "Banana", "Cherry"]` becomes the CSV value `"Apple; Banana; Cherry"`.

The generated file is named `scraping-results-[uuid].csv`, where `[uuid]` is a randomly generated UUID (v4) that ensures each export produces a unique filename, preventing accidental overwrites of previous exports. The file is downloaded using the Blob URL mechanism: the CSV string is wrapped in a `Blob` object with the MIME type `text/csv`, an object URL is created via `URL.createObjectURL()`, a temporary `<a>` element is created with the `download` attribute set to the filename, the click event is programmatically dispatched, and the object URL is revoked after a 100ms timeout. The 100ms delay ensures that the browser has sufficient time to initiate the download before the URL is invalidated, while being short enough to prevent resource leaks.

---

## JSON Export

The JSON export feature provides an alternative to CSV for users who need structured, machine-readable output. JSON is the preferred format for programmatic consumption—feeding data into APIs, processing with Node.js or Python scripts, or storing in document databases—and the export is designed to preserve the full fidelity of the scraped data, including array values that are flattened in the CSV format. The export is triggered by clicking the "Export → JSON" button in the results header.

Like the CSV export, the JSON export respects the per-page filter: only data from currently selected pages is included in the exported file. If no results are available when the export button is clicked, the function displays a browser alert with the message "No results to export." This is the same safeguard used by the CSV export, preventing the creation of empty JSON files and ensuring the user is informed that the export did not occur.

The JSON format is a flat array of row objects, produced by merging all items from the selected pages into a single array. The output is generated using `JSON.stringify(items, null, 2)`, which produces pretty-printed JSON with 2-space indentation. Pretty-printing was chosen over minified JSON because the primary consumers of the exported file are humans inspecting the data and developers debugging their scraping configurations—both use cases benefit greatly from readable formatting. The file size overhead of indentation is negligible for the typical datasets produced by the Simple Web Scraper (hundreds to low thousands of rows), and users who need compact JSON can easily minify the output with standard tools.

A critical difference between the JSON and CSV exports is the handling of array values. In the CSV export, array values are joined into a semicolon-delimited string because CSV does not natively support nested data structures. In the JSON export, array values remain as native JSON arrays. For example, if a column named "Tags" contains the array `["news", "tech", "AI"]`, the JSON export preserves this as `"Tags": ["news", "tech", "AI"]` rather than converting it to `"Tags": "news; tech; AI"`. This preservation of structure makes JSON the preferred format for any downstream processing that needs to operate on individual values within multi-value columns.

The generated file is named `scraping-results-[uuid].json`, using the same UUID-based naming convention as the CSV export. The download mechanism is identical: the JSON string is wrapped in a `Blob` with the MIME type `application/json`, an object URL is created, a temporary link element is clicked, and the URL is revoked after a 100ms timeout. The UUID ensures that each JSON export produces a unique filename, and the `application/json` MIME type ensures that the browser correctly identifies the file format when saving it to disk.

---

## Progressive Results (Multi-Page / Scrolling)

During multi-page or scrolling scraping operations, results do not arrive all at once—they arrive progressively as each page or scroll iteration is processed by the content script. The results module is designed to handle this progressive data flow gracefully, updating the display in real time so that users can monitor the scraping progress and review partial results before the entire operation completes.

Each progress event is communicated via a `scrapingProgress` message sent from the content script to the sidebar through the Chrome messaging API. The message payload contains a `Page` object (or an object matching the `Page` interface) with the `index`, `items`, and `diagnostics` fields populated for the completed step. When the results module receives a progress message, it searches the `pages` array for an existing entry with the same `index`. If found, the existing entry is replaced with the new data (this handles re-scraping and in-place updates). If not found, the new page object is appended to the array. After the addition or replacement, the array is sorted by `index` to maintain the correct page order regardless of the arrival sequence.

Following each array mutation, the module updates two UI components: the pages dropdown and the results table. The pages dropdown is refreshed to reflect the current set of available pages, adding new checkboxes for pages that have not been seen before while preserving the checked/unchecked state of existing checkboxes. The results table is re-rendered using the items from all selected pages, incorporating the newly arrived data. This immediate re-rendering ensures that users see each page's results as soon as they are available, without needing to manually refresh or wait for the entire operation to complete.

The results view is opened proactively by `schema-manager.startScraping()` at the very beginning of the scraping operation, before any progress messages have been received. This proactive opening serves two purposes. First, it provides immediate visual feedback that the scrape has started, replacing the sidebar's configuration panel with the results view and signaling the transition from setup to execution. Second, it creates the DOM elements and event listeners needed to display progressive results, so that the first progress message can be rendered immediately without waiting for the modal to be constructed. The empty results view—with its blank table, "No pages yet" dropdown placeholder, and "No diagnostics available" message—makes it clear that the system is live and waiting for data, rather than appearing broken or unresponsive.

---

## Reset

When the results view is closed via the `hideResultsView()` function, a complete reset of the results module's state is performed. The `pages` array is cleared entirely, removing all stored page objects, their items, and their diagnostics from memory. The `totalPagesPlanned` variable is reset to its initial value of 1, ensuring that the next scraping session starts with a clean slate. This destructive reset is a deliberate design choice that prioritizes simplicity and data consistency over the convenience of preserving results between views.

The rationale for clearing results on close is threefold. First, it prevents stale data from contaminating future sessions. If a user closes the results view, modifies the scraping schema, and starts a new scrape, they should see only the new results—not a mixture of old and new data that would be confusing and potentially misleading. Second, it simplifies the module's internal logic by eliminating the need for merge-or-replace heuristics when a new scraping session produces pages with the same indices as a previous session. Third, it reduces memory consumption, which is particularly important for a Chrome extension running in a constrained environment where the sidebar's DOM and JavaScript heap share resources with the host page.

Users who wish to preserve their results before closing the view must export the data to CSV or JSON using the export buttons in the results header. The export functionality is always available while the results view is open, and the exported files are permanent—they are not affected by the results module's internal reset. This workflow—scrape, review, export, close—encourages users to save their data promptly and avoids the false sense of security that would come from silently persisting results in memory (which would be lost anyway when the sidebar is closed or the browser is restarted).
