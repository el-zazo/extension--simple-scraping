# Schema Configuration Reference

> **Simple Web Scraper** Chrome Extension &mdash; v1.0.0 (Manifest V3)

This document is the authoritative reference for the schema configuration format used by the Simple Web Scraper extension. Every scraping job is driven by a schema object that tells the extension which elements to target, how to extract data from them, and which scraping mode to operate in. Understanding the schema structure is essential for creating, editing, importing, and troubleshooting scraping configurations. The sections below describe each field, type, and behavioral rule in detail.

---

## Table of Contents

- [Overview](#overview)
- [Schema Object](#schema-object)
- [Column Object](#column-object)
- [Column Types](#column-types)
- [Column Options](#column-options)
  - [Multiple Elements](#multiple-elements-multiple_elements-true)
  - [Many Values](#many-values-many_values-true)
  - [Use RegExp](#use-regexp-use_regexp--regexp_pattern)
- [Scraping Modes](#scraping-modes)
  - [Single Page](#single-page-default)
  - [Multi-Page Pagination](#multi-page-pagination)
  - [Scrolling Mode (Infinite Scroll)](#scrolling-mode-infinite-scroll)
- [Schema Import / Export](#schema-import--export)
  - [Export](#export)
  - [Import](#import)
- [Schema Search & Sort](#schema-search--sort)
  - [Search](#search)
  - [Sort Options](#sort-options)

---

## Overview

Schemas are persisted as JSON objects inside `chrome.storage.local` under the key `schemas`, which holds an array of schema objects. When a user creates a new scraping configuration through the extension popup or options page, a new schema object is constructed, assigned a unique identifier, and appended to this array. All scraping operations read from this stored array, and any modifications (edits, deletions, imports) write the entire array back to storage. Because `chrome.storage.local` has generous size limits and persists across browser sessions, schemas survive restarts and updates of the extension. The schema format was designed to be self-contained: a single schema carries everything needed to locate elements on a page, extract specific pieces of data, handle pagination or infinite scrolling, and apply post-processing such as regular expressions. This design makes schemas portable and easy to share via the import/export feature.

---

## Schema Object

The schema object is the top-level container for an entire scraping configuration. Each field controls a distinct aspect of the scraping behaviour, from element selection to pagination timing. Below is the full TypeScript interface followed by a field-by-field explanation.

```typescript
interface Schema {
  id: string;                    // UUID v4, generated on creation
  name: string;                  // Required. User-defined name (e.g., "Product List")
  description: string;           // Optional. Free text description
  parentSelector: string;        // CSS selector for the parent container
  cardSelector: string;          // CSS selector for each card/item within parent
  nextButtonSelector: string;    // Optional. CSS selector for pagination "next" button
  nextDelayMs: number;           // Delay in ms after clicking next button (default: 0)
  maxPages: number;              // Max pages to scrape (default: 1)
  enableScrolling: boolean;      // Enable infinite-scroll scraping mode
  scrollByPx: number;            // Pixels to scroll per step (default: 1000)
  scrollPauseMs: number;         // Pause after each scroll in ms (default: 1000)
  maxScrollSteps: number;        // Safety limit for scroll steps; 0 = auto-calculate from page height
  columns: Column[];             // Array of column definitions
  created_at: number;            // Unix timestamp (Date.now())
  updated_at: number;            // Unix timestamp (Date.now())
}
```

### Field Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `string` | Auto | — | UUID v4 generated at creation time. Uniquely identifies the schema within the `schemas` array and is used for duplicate detection during import. |
| `name` | `string` | Yes | — | A human-readable label for the schema. Displayed in the schema list, used as the primary search target, and appended with "(Copy)" when the `keep-both` import strategy is used. Must not be empty. |
| `description` | `string` | No | `""` | Free-form text that provides context or notes about the schema. It is searched alongside the name when the user filters schemas, but is otherwise optional and has no effect on scraping behaviour. |
| `parentSelector` | `string` | Yes | — | A CSS selector that identifies the container element wrapping all the items to be scraped. The scraper scopes card-element queries to this parent when it is provided, which improves performance and accuracy on complex pages. |
| `cardSelector` | `string` | Yes | — | A CSS selector that matches each individual item or "card" inside the parent container. The scraper iterates over all elements matching this selector (within the parent if specified) and extracts column data from each one. |
| `nextButtonSelector` | `string` | No | `""` | CSS selector for the pagination "next" button. When provided together with `maxPages > 1`, the scraper enters multi-page pagination mode and clicks this button to advance pages. If the button cannot be found on a page, pagination stops early. |
| `nextDelayMs` | `number` | No | `0` | The number of milliseconds to wait after clicking the next button before scraping the new page. This delay allows time for dynamic content to load. A value of `0` means no delay. |
| `maxPages` | `number` | No | `1` | The maximum number of pages to scrape during a pagination run. Setting this to `1` (or leaving it at the default) disables pagination unless a `nextButtonSelector` is also provided, in which case the scraper will attempt one page. |
| `enableScrolling` | `boolean` | No | `false` | When `true`, activates infinite-scroll scraping mode instead of single-page or pagination mode. The scraper will progressively scroll down the page, extracting newly discovered card elements at each step. |
| `scrollByPx` | `number` | No | `1000` | The number of pixels to scroll downward on each step in scrolling mode. The minimum value is `1`; any value below that is clamped. Larger values scroll faster but may skip over dynamically loaded content. |
| `scrollPauseMs` | `number` | No | `1000` | The pause in milliseconds after each scroll step, giving the page time to load additional content. If the value is `0` or empty, it falls back to `1000` ms to prevent the scraper from overwhelming the page or missing data. |
| `maxScrollSteps` | `number` | No | `0` | A safety limit on how many scroll steps to perform. A value of `0` (or empty) means the limit is auto-calculated as `Math.ceil(document.body.scrollHeight / scrollByPx)` at the start of the scrape. This prevents infinite loops on pages that keep growing. |
| `columns` | `Column[]` | Yes | `[]` | An array of column definitions. Each column describes one piece of data to extract from every card element. A schema with an empty columns array will produce no data. See the [Column Object](#column-object) section for full details. |
| `created_at` | `number` | No | Auto | Unix timestamp (from `Date.now()`) recording when the schema was first created. Set automatically on creation and never modified afterwards. Used as the default sort key (newest first). |
| `updated_at` | `number` | No | Auto | Unix timestamp (from `Date.now()`) recording when the schema was last modified. Updated automatically every time the schema is saved. Used for sorting by most recently edited. |

---

## Column Object

Each schema contains an array of column objects that define what data to extract from each card element and how to process it. Columns are evaluated independently for every card, and the results form the rows of the output table. The column interface provides fine-grained control over element targeting, extraction type, and optional post-processing.

```typescript
interface Column {
  id: string;                    // UUID v4, unique per column
  name: string;                  // Column name (e.g., "Title")
  selector: string;              // CSS selector to find the element within a card
  type: ColumnType;              // Extraction type (default: "text")
  attribute_name: string;        // Required when type="attribute". The attribute to extract
  style_property: string;        // Required when type="style". The CSS property name
  use_regexp: boolean;           // Enable RegExp post-processing
  regexp_pattern: string;        // RegExp pattern (plain or /pattern/flags format)
  multiple_elements: boolean;    // Column exists at multiple indices on the page (non-card fallback)
  many_values: boolean;          // Extract all matching elements within a card as an array
}

type ColumnType = "text" | "html" | "attribute" | "href" | "src" | "style";
```

### Field Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `string` | Auto | — | UUID v4 unique identifier for this column within the schema. Used to track columns across edits and is required during import validation. |
| `name` | `string` | Yes | — | A human-readable column name that appears as the header in the results table. Examples include "Title", "Price", "Image URL". Must not be empty. |
| `selector` | `string` | Yes | — | A CSS selector used to locate the target element within each card. The selector is scoped to the card element, so it only needs to be specific enough to match within that context. For example, `"h2"` or `".product-title a"`. |
| `type` | `ColumnType` | No | `"text"` | Determines the extraction method applied to the matched element. See [Column Types](#column-types) for the full list and behaviour of each type. |
| `attribute_name` | `string` | Cond. | `""` | Required when `type` is `"attribute"`. Specifies the name of the HTML attribute to extract, such as `"data-id"`, `"title"`, or `"aria-label"`. Ignored for all other types. |
| `style_property` | `string` | Cond. | `""` | Required when `type` is `"style"`. Specifies the CSS property name to read via `getComputedStyle`, such as `"background-color"`, `"font-size"`, or `"display"`. The computed value is returned as a string. Ignored for all other types. |
| `use_regexp` | `boolean` | No | `false` | When `true`, the value extracted by the column's type is passed through a regular expression before being included in the results. The pattern is taken from `regexp_pattern`. See [Use RegExp](#use-regexp-use_regexp--regexp_pattern) for detailed behaviour. |
| `regexp_pattern` | `string` | No | `""` | The regular expression pattern to apply when `use_regexp` is `true`. Supports both literal (`/pattern/flags`) and plain string formats. See [Use RegExp](#use-regexp-use_regexp--regexp_pattern) for the full specification. |
| `multiple_elements` | `boolean` | No | `false` | When `true`, indicates that this column corresponds to multiple elements on the page rather than a single element per card. Used in non-card scraping scenarios where data is aligned by index across multiple columns. See [Multiple Elements](#multiple-elements-multiple_elements-true). |
| `many_values` | `boolean` | No | `false` | When `true`, all elements matching the column's selector within a single card are extracted as an array, rather than just the first match. See [Many Values](#many-values-many_values-true). |

---

## Column Types

The `type` field on a column determines which JavaScript API is used to extract data from the matched element. Each type maps to a specific DOM property or method, and some types require additional configuration fields. Choosing the correct type is critical: for instance, using `"text"` on an image element will return an empty string, whereas `"src"` will return the resolved image URL. The table below lists every supported type, what it extracts, and any additional fields that must be populated.

| Type | Description | Additional Fields |
|------|-------------|-------------------|
| `text` | Extracts `element.textContent.trim()`. This is the most commonly used type and is suitable for headings, paragraphs, spans, and any visible text content. Whitespace at the beginning and end is removed, but internal whitespace is preserved. | — |
| `html` | Extracts `element.innerHTML.trim()`. Returns the raw HTML markup inside the element, including tags. Useful when you need the structural markup itself, such as embedded lists or formatted content. | — |
| `attribute` | Extracts a named HTML attribute value via `element.getAttribute(attribute_name)`. This is a general-purpose type for reading any attribute: `data-*` attributes, `title`, `alt`, `class`, and so on. | `attribute_name` (required) |
| `href` | Extracts `element.href`, which returns the fully resolved absolute URL. This is preferable to `attribute` with `attribute_name="href"` because the browser automatically resolves relative URLs against the page's base URL, ensuring the result is always a complete, usable link. | — |
| `src` | Extracts `element.src`, which returns the fully resolved absolute URL for image, video, audio, and other source elements. Like `href`, this resolves relative URLs automatically, making it more reliable than using `attribute` with `attribute_name="src"`. | — |
| `style` | Extracts a computed CSS property value via `getComputedStyle(element).getPropertyValue(style_property)`. Returns the final computed style after all CSS rules and inline styles have been applied. Useful for extracting colours, dimensions, visibility, or any other rendered CSS property. | `style_property` (required) |

---

## Column Options

Beyond the basic type-based extraction, columns support three powerful options that alter how elements are located and how their values are processed. These options can be combined in certain scenarios, though `multiple_elements` and `many_values` serve distinct purposes and are typically not used together on the same column.

### Multiple Elements (`multiple_elements: true`)

The `multiple_elements` flag is designed for a specific scraping pattern: pages where there is no single card container, but instead the data is spread across multiple lists or groups of elements at the same index positions. A common example is a product grid where names, prices, and images are each in separate sibling containers rather than wrapped in individual card elements.

When a column is marked as `multiple_elements`, the scraper treats that column's selector as matching multiple elements across the entire page (not scoped to a card). The first column in the schema that has `multiple_elements: true` becomes the **base column** for iteration — its match count determines the number of rows in the output. Other columns also marked as `multiple_elements` are aligned by index: the first name pairs with the first price, the second with the second, and so on. Columns that do **not** have `multiple_elements` set are treated as shared values: a single value is extracted and repeated across every row. This alignment-by-index approach means the page structure must be consistent for the data to line up correctly; mismatched counts between multiple-elements columns will result in undefined values for the shorter columns.

### Many Values (`many_values: true`)

The `many_values` flag operates within card-based scraping. By default, a column's selector is expected to match a single element inside each card, and only the first match is used. However, some cards contain repeating sub-elements — such as a list of tags, multiple image thumbnails, or several pricing options — and you may want to capture all of them rather than just the first.

When `many_values` is `true`, the scraper queries all elements matching the column's selector within the card and collects their extracted values into an array. Empty values (strings that are empty after trimming) are filtered out of this array, so you get a clean list of meaningful results. In the results table, arrays are rendered as bullet lists for readability. If no elements match, the result is an empty array. This option is particularly useful for tags, categories, image galleries, and any scenario where a card contains a variable number of sub-items that you want to preserve as a collection rather than a single value.

### Use RegExp (`use_regexp: true` + `regexp_pattern`)

The `use_regexp` flag enables regular-expression post-processing on the value extracted by the column's type. This is applied after the initial extraction, meaning it works with any column type — you can apply a regex to text, attributes, hrefs, or even computed style values. The `regexp_pattern` field holds the pattern to apply, and it supports two formats:

**Literal format** — `/pattern/flags` — For example, `/url\("([^"]+)"\)/i`. The extension parses this format by splitting on the delimiters to extract the pattern string and any flags (such as `i` for case-insensitive, `g` for global, `m` for multiline). This is the preferred format when you need flags or want the pattern to be visually distinct.

**Plain format** — Any string that does not start with `/` — For example, `\d+\.\d+`. The string is used as-is as the RegExp pattern with no flags. This is convenient for simple patterns that do not require flags.

The matching behaviour is as follows: the regex is executed against the extracted string value. If the regex contains captured groups and a match is found, the first captured group (`match[1]`) is returned. If there are no captured groups but a match is found, the full match (`match[0]`) is returned. If there is no match at all, the original extracted value is returned unchanged — this graceful fallback ensures that a misconfigured regex does not destroy data. Similarly, if the pattern is syntactically invalid and throws an error during RegExp construction or execution, the original value is returned. This error-tolerance design means you can experiment with patterns without risking data loss.

---

## Scraping Modes

The Simple Web Scraper supports three distinct scraping modes, each suited to a different page architecture. The mode is determined automatically based on the schema's configuration fields — there is no explicit `mode` field. The decision logic is as follows: if `enableScrolling` is `true`, scrolling mode is activated; otherwise, if `maxPages > 1` or a `nextButtonSelector` is provided, multi-page pagination mode is used; otherwise, single-page mode is the default.

### Single Page (default)

Single-page mode is the simplest and most common scraping mode. It is triggered when `enableScrolling` is `false` and there is no pagination configuration (i.e., `maxPages <= 1` and no `nextButtonSelector`). In this mode, the content script queries the page once for all card elements matching `cardSelector` (optionally scoped to `parentSelector`), extracts the column data from each card, and immediately sends the results back to the extension popup. There is no waiting, no scrolling, and no navigation. This mode is ideal for static pages where all data is visible without interaction, such as a single product listing, a blog archive, or a search results page that does not use pagination or infinite scrolling. Because it involves only a single DOM query pass, it is also the fastest mode and has the lowest risk of timing-related issues.

### Multi-Page Pagination

Multi-page pagination mode is triggered when `maxPages > 1` or `nextButtonSelector` is provided. It is designed for sites that split content across multiple pages with a "Next" button or link. The scraper iterates through pages sequentially, extracting data from each one before advancing. The workflow for each page is:

1. **Scrape the current page.** All card elements matching `cardSelector` (within `parentSelector` if specified) are located, and column data is extracted from each one.
2. **Report progress.** A `scrapingProgress` message is sent to the extension popup, containing the current `pageIndex` and `totalPages`, so the UI can display a progress indicator.
3. **Click the next button.** If this is not the last page, the element matching `nextButtonSelector` is clicked to navigate to the next page of results.
4. **Wait for content to load.** The scraper pauses for `nextDelayMs` milliseconds after clicking the next button. This delay accounts for network latency and dynamic rendering.
5. **Handle missing next button.** If the next button cannot be found on the page, the scraper stops early and sends a `scrapingDone` message. This graceful termination handles the common case where the last page has no next button.
6. **Complete.** After all configured pages have been scraped (or pagination stops early), a `scrapingDone` message is sent with the full result set.

The `nextDelayMs` value is critical for sites that load content dynamically. Setting it too low may cause the scraper to capture the previous page's data; setting it too high slows down the scraping process. Users should experiment with this value based on the target site's loading behaviour.

### Scrolling Mode (Infinite Scroll)

Scrolling mode is triggered when `enableScrolling` is `true`. It is designed for modern web applications that use infinite scrolling to progressively load content as the user scrolls down, such as social media feeds, image galleries, and product grids. Instead of navigating between pages, the scraper scrolls the page step by step, extracting new cards as they appear. The workflow for each scroll step is:

1. **Find card elements.** The scraper queries the page for all elements matching `cardSelector` (optionally within `parentSelector`).
2. **Filter out already-scraped cards.** Cards that have been processed in previous steps are identified by the presence of a `scraped="true"` attribute that the scraper sets on each card after extraction. This prevents duplicate rows in the output.
3. **Extract data from new cards.** Column data is extracted from each new card and appended to the results.
4. **Mark cards as scraped.** Each processed card receives `scraped="true"` to mark it as done.
5. **Report progress.** If new results were found during this step, a `scrapingProgress` message is sent to the popup.
6. **Scroll the page.** The page is scrolled downward by `scrollByPx` pixels using `window.scrollBy`.
7. **Wait for content to load.** The scraper pauses for `scrollPauseMs` milliseconds to allow the browser to load and render new content triggered by the scroll event.
8. **Repeat.** The process repeats until the `maxScrollSteps` limit is reached.

**Scrolling configuration defaults and constraints:**

- `scrollByPx`: Defaults to `1000` pixels. The minimum value is `1`; values below this are clamped. Larger values cover more ground per step but may miss content that loads lazily at intermediate scroll positions.
- `scrollPauseMs`: Defaults to `1000` milliseconds. If set to `0` or left empty, the value falls back to `1000` ms automatically. This safeguard prevents the scraper from scrolling so fast that the page cannot load new content, which would result in the scraper terminating early with incomplete data.
- `maxScrollSteps`: Defaults to `0`, which triggers auto-calculation. When auto-calculated, the value is `Math.ceil(document.body.scrollHeight / scrollByPx)` — essentially, the number of steps needed to scroll from the top to the bottom of the page at the configured scroll distance. This provides a reasonable safety limit that adapts to the page's actual height. Setting an explicit positive number overrides the auto-calculation and caps the scraper at that many steps, which is useful for testing or when you only need a fixed amount of data.

---

## Schema Import / Export

The Simple Web Scraper provides built-in import and export functionality so that users can back up their schemas, share configurations with colleagues, or migrate setups between browsers. Both operations work with JSON files, preserving all schema fields exactly as they are stored internally. This ensures round-trip fidelity: exporting and re-importing a set of schemas produces an identical configuration.

### Export

When the user triggers an export, the extension reads the entire `schemas` array from `chrome.storage.local` and serializes it as a JSON array. The resulting file is saved as `simple-scraper-schemas.json` using the browser's download API. The file contains the complete schema objects with all fields, including `id`, `name`, `description`, all selectors, scrolling configuration, column definitions, and timestamps. No fields are omitted or transformed during export. Because the file is pure JSON, it can be inspected in any text editor, version-controlled in a repository, or processed by external tools. Users should be aware that the file reflects the state of the schemas at the moment of export; any subsequent edits to schemas in the browser will not be reflected in a previously exported file.

### Import

When the user triggers an import, the extension prompts for a JSON file and parses it. The file must contain a JSON array of schema objects at the top level. Each schema object in the array is validated according to the following rules:

- **Schema-level validation:** The object must have an `id` field (string), a `name` field (string), and a `columns` field (array). If any of these are missing or have the wrong type, the schema is marked as invalid and skipped.
- **Column-level validation:** Each object within the `columns` array must have an `id` field (string), a `name` field (string), a `selector` field (string), and a `type` field (string). Columns that fail validation cause the entire schema to be marked as invalid.

**Duplicate Handling Options:**

When a schema being imported has the same `id` as a schema already in storage, the user chooses one of three conflict-resolution strategies:

| Option | Behavior |
|--------|----------|
| `skip` | The existing schema in storage is preserved and the imported schema is discarded. This is the safest option when you are unsure whether the imported version is newer. |
| `replace` | The existing schema is overwritten by the imported one. All fields of the existing schema are replaced, including columns, selectors, and timestamps. Use this when you want the imported version to take precedence. |
| `keep-both` | The imported schema is assigned a new UUID v4 `id` and its `name` is appended with " (Copy)" to distinguish it from the original. Both schemas then coexist in the `schemas` array. This is useful when you want to compare or merge two versions manually. |

After the import process completes, a summary alert is displayed showing four counts: schemas successfully added (new entries), schemas replaced (overwritten existing), schemas skipped (duplicates kept as-is), and schemas that were invalid (failed validation and were not imported). This gives the user a clear picture of what happened and whether any attention is needed.

---

## Schema Search & Sort

As the number of saved schemas grows, finding a specific configuration becomes important. The Simple Web Scraper provides search and sort functionality on the schema list to help users quickly locate the schema they need. Both features operate on the in-memory array of schemas loaded from `chrome.storage.local` and are applied before rendering the list in the extension's UI.

### Search

The search function filters the schemas array by matching the user's query against the `name` and `description` fields of each schema. Matching is case-insensitive and uses substring containment — meaning the query can appear anywhere within the field value. For example, searching for "product" would match a schema named "Product List" as well as one with the description "Scrapes product details from the catalog page." Schemas that match either the name or the description (or both) are included in the results. If the search query is empty, no filtering is applied and all schemas are shown. The search is performed client-side with no debouncing requirements, so it responds instantly as the user types.

### Sort Options

The sort function orders the filtered (or unfiltered) schema list by a user-selected criterion. Six sort options are available, covering the two most useful fields (name and timestamps) in both ascending and descending directions. The sort is applied after search filtering, so it only reorders the visible schemas.

| Value | Field | Direction |
|-------|-------|-----------|
| `name:asc` | Name | A–Z (lexicographic, case-insensitive) |
| `name:desc` | Name | Z–A (reverse lexicographic, case-insensitive) |
| `created_at:desc` | Created timestamp | Newest first |
| `created_at:asc` | Created timestamp | Oldest first |
| `updated_at:desc` | Updated timestamp | Newest first |
| `updated_at:asc` | Updated timestamp | Oldest first |

The default sort is `created_at:desc`, which means newly created schemas appear at the top of the list. This default was chosen because users most often want to access their most recently created configurations. The sort preference is ephemeral — it is not persisted across sessions and resets to the default when the extension popup is reopened. Name-based sorts use case-insensitive comparison via `localeCompare`, ensuring that "Apple" and "apple" sort adjacently regardless of capitalization.
