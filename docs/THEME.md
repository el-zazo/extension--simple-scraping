# Simple Web Scraper — Theming Reference

> **Extension Version:** 1.0.0 | **Manifest Version:** V3 | **Document Version:** 1.0

---

## Overview

The Simple Web Scraper Chrome extension ships with full support for both light and dark visual themes, implemented entirely through CSS custom properties (also known as CSS variables). This approach was chosen because CSS custom properties cascade naturally through the DOM, allowing a single attribute change on the root `<html>` element to propagate instantly across every component in the extension's popup and sidebar panels—no JavaScript class-toggling on individual elements is required. The user's theme preference is persisted across browser sessions using `chrome.storage.local` under the key `simple_scraper_theme`. This ensures that every time the extension is opened, the previously selected theme is restored seamlessly without any visible flicker or flash of unstyled content. The default theme is **dark**, which means that on first installation—or whenever the stored preference is missing, corrupted, or unrecognized—the extension will render in dark mode. This default was chosen because developer-oriented tools tend to be used more frequently in dark environments, and the dark palette provides strong contrast for the extension's syntax-highlighted selector previews and diagnostic output.

---

## Theme Toggle

The theme toggle button is located in the sidebar header, positioned adjacent to the minimize and delete (close) buttons. Its placement in the header ensures that it remains visible and accessible at all times, regardless of how far the user has scrolled within the sidebar or which panel is currently active. Clicking the toggle switches the active theme between light and dark immediately—there is no animation delay or transition period, so the entire UI repaints in the new color scheme the instant the click event fires.

The toggle icon changes depending on the currently active theme. When the **light** theme is active, the icon displays a moon emoji (🌙), indicating that clicking it will switch to the dark theme. Conversely, when the **dark** theme is active, the icon displays a sun emoji (☀️), indicating that clicking it will switch to the light theme. This convention—showing the destination state rather than the current state—follows common UI patterns found in operating systems and popular web applications, making the toggle intuitive even for first-time users.

An important design decision is that the theme toggle is **never disabled**, even during an active scraping operation. While many UI elements are intentionally greyed out or disabled while the scraper is running (to prevent conflicting state changes), the theme toggle remains fully interactive at all times. This is because changing the theme is a purely cosmetic operation that does not affect the scraping state, data integrity, or selector configuration in any way. Users frequently wish to adjust the visual appearance mid-scrape, especially during long-running multi-page operations, and locking the toggle would add unnecessary friction.

---

## CSS Custom Properties

### Light Theme (Default Root Variables)

The light theme is defined as the default set of CSS custom properties on the `:root` pseudo-class. When no `data-theme` attribute is present on the `<html>` element, or when `data-theme="light"` is explicitly set, these values govern the entire visual appearance of the extension. The palette was designed to match Google's Material Design light color system, ensuring consistency with the Chrome browser's own UI and with popular Google web applications that users are already familiar with.

| Variable | Value | Purpose |
|----------|-------|---------|
| `--bg-primary` | `#f5f5f5` | Main background — applied to the sidebar body, modal overlays, and all top-level containers. This soft off-white avoids the harshness of pure white (`#ffffff`) while maintaining excellent readability and a clean, airy feel. |
| `--bg-secondary` | `#ffffff` | Card/modal background — used for elevated surfaces such as result cards, modal content panels, dropdown menus, and tooltip containers. The pure white creates visual separation from the primary background, establishing a clear sense of depth and hierarchy. |
| `--bg-tertiary` | `#f1f3f4` | Secondary button background — applied to buttons with lower visual prominence (e.g., "Cancel," "Back," page filter toggles). This near-white grey ensures these controls are distinguishable from the background without competing with primary action buttons. |
| `--bg-hover` | `#e8eaed` | Hover state background — applied to interactive elements (list items, table rows, buttons) on mouse hover. The subtle darkening provides clear feedback that an element is interactive without being visually jarring. |
| `--bg-highlight` | `#e8f0fe` | Selector highlight animation — used for the animated outline that appears on the page when the user hovers over elements during selector configuration. The pale blue is bright enough to be noticeable against most web page backgrounds while remaining pleasant and non-intrusive. |
| `--text-primary` | `#333333` | Primary text color — applied to headings, body copy, labels, and any text that needs maximum readability. This is not pure black (`#000000`) because pure black on white creates excessive contrast that can cause eye strain during extended use. |
| `--text-secondary` | `#5f6368` | Secondary/muted text — used for descriptions, timestamps, placeholder text, and supplementary information that should be readable but visually de-emphasized relative to primary text. |
| `--border-color` | `#dadce0` | Border color — applied to divider lines, input field borders, card outlines, and table cell borders. This light grey is visible enough to define structure without creating heavy, boxy layouts. |
| `--shadow-color` | `rgba(0,0,0,0.1)` | Box shadow color — used for elevation shadows on modals, dropdowns, and floating elements. The low opacity creates a subtle depth effect appropriate for light backgrounds. |
| `--primary-color` | `#4285f4` | Primary action color (blue) — applied to primary buttons, active tabs, links, focus rings, and any element that demands the user's attention. This is Google Blue 500, chosen for its accessibility (WCAG AA compliant on white) and brand consistency. |
| `--primary-color-dark` | `#3367d6` | Primary hover color — applied when the user hovers over primary action elements. The slightly darker shade provides clear hover feedback while maintaining the blue identity. |
| `--header-bg` | `#4285f4` | Header background — applied to the sidebar header bar and modal headers. Uses the same Google Blue as the primary color, creating a cohesive visual anchor at the top of every view. |
| `--header-text` | `#ffffff` | Header text — applied to all text within header bars (titles, button labels, icons). White on blue provides excellent contrast and readability. |
| `--table-header-bg` | `#f1f3f4` | Table header background — applied to `<thead>` rows in the results table. This distinguishes header cells from data rows without introducing an additional color. |
| `--table-row-hover` | `#f8f9fa` | Table row hover — applied to `<tr>` elements on mouse hover in the results table. The extremely subtle darkening differentiates the hovered row from its neighbors. |

### Dark Theme (`[data-theme="dark"]`)

The dark theme is activated by setting `data-theme="dark"` on the `<html>` element, which causes the CSS selector `[data-theme="dark"]` to override all root-level custom properties. The palette was crafted to meet WCAG AA contrast requirements on dark backgrounds, ensuring that text remains legible and interactive elements remain discoverable even in low-light environments. Every color in the dark palette was tested against the most common usage contexts within the extension—result tables with many columns, selector configuration panels with nested dropdowns, and diagnostic output with mixed text sizes—to verify that the contrast ratios remain above the 4.5:1 minimum for normal text and 3:1 for large text.

| Variable | Value | Purpose |
|----------|-------|---------|
| `--bg-primary` | `#202124` | Main background — the deep charcoal that serves as the base layer for all dark-theme surfaces. This is Google's standard dark surface color, chosen to minimize light emission on OLED displays while providing sufficient contrast for the lighter text and UI elements layered on top. |
| `--bg-secondary` | `#292a2d` | Card/modal background — slightly lighter than the primary background to create visual elevation. This subtle difference establishes a clear hierarchy between the base canvas and raised components like modals, dropdowns, and card containers. |
| `--bg-tertiary` | `#3c4043` | Secondary button background — used for less prominent interactive elements. This medium grey is dark enough to recede visually but light enough to be clearly distinguishable from the background, ensuring users can identify clickable targets. |
| `--bg-hover` | `#4a4c50` | Hover state background — applied on hover to provide interactive feedback. The noticeable brightness increase makes it clear that an element is being targeted, which is especially important in dark themes where subtle changes can be harder to perceive. |
| `--bg-highlight` | `#3b4b65` | Selector highlight animation — a muted steel blue used for the element-selection overlay during scraping configuration. This color was specifically chosen to be visible against both the dark extension UI and most dark-themed web pages, without being so bright that it distracts from the page content being selected. |
| `--text-primary` | `#e8eaed` | Primary text color — the main text color for all dark-theme content. This near-white provides excellent readability on dark backgrounds without the harshness of pure white, reducing eye strain during extended scraping sessions. |
| `--text-secondary` | `#9aa0a6` | Secondary/muted text — used for less important information, descriptions, and metadata. This mid-grey is carefully calibrated to be readable against the dark background while clearly subordinate to primary text. |
| `--border-color` | `#5f6368` | Border color — applied to all structural borders. In dark themes, borders must be light enough to be visible against the dark background but not so bright as to create a heavy, grid-like appearance. This shade strikes that balance. |
| `--shadow-color` | `rgba(0,0,0,0.3)` | Box shadow color — elevated shadows use a higher opacity than the light theme because dark surfaces absorb more light, requiring stronger shadow definition to convey depth effectively. |
| `--primary-color` | `#8ab4f8` | Primary action color (lighter blue) — Google Blue 300, specifically chosen because the standard Google Blue 500 (`#4285f4`) fails WCAG contrast requirements on dark backgrounds. This lighter shade maintains the blue identity while ensuring sufficient contrast against dark surfaces. |
| `--primary-color-dark` | `#669df6` | Primary hover color — slightly darker than the primary color, providing the expected "darken on hover" pattern while staying within the accessible blue range for dark backgrounds. |
| `--header-bg` | `#1a73e8` | Header background — a deeper blue than the light theme's header, optimized for dark environments. This shade provides a strong visual anchor at the top of the sidebar while maintaining text contrast with the white header text. |
| `--header-text` | `#ffffff` | Header text — pure white for maximum contrast against the blue header background, ensuring titles and button labels remain crisp and readable. |
| `--table-header-bg` | `#3c4043` | Table header background — matches the tertiary background to create visual consistency between table headers and secondary button elements, reinforcing the design language. |
| `--table-row-hover` | `#35363a` | Table row hover — a subtle lightening of the primary background, just enough to highlight the row under the cursor without being distracting in a dense data table. |

---

## Theme Storage

The theme preference is stored in `chrome.storage.local` under the key `simple_scraper_theme`. This storage mechanism was chosen over `chrome.storage.sync` deliberately: theme preference is a local UX decision that should not propagate across a user's Chrome instances on different machines. A user who prefers light mode on a desktop with a bright monitor may well prefer dark mode on a laptop used in dim environments, and syncing the preference would override their local choice.

The stored value is a plain string: either `"light"` or `"dark"`. No other values are recognized. The default is `"dark"`, which is applied in all of the following scenarios: the key does not exist in storage (first install), the stored value is `undefined` or `null`, the stored value is an empty string, or the stored value is any string other than `"light"`. This fail-safe design ensures that the extension always has a valid visual state, even if the storage becomes corrupted or is manually edited through the Chrome DevTools storage inspector.

When the theme is toggled by the user, the new preference is written to `chrome.storage.local` immediately via the `chrome.storage.local.set()` API. The write operation is asynchronous but the UI updates synchronously—there is no perceptible delay between the click and the visual change. If the storage write were to fail (which is exceptionally rare but theoretically possible if the storage quota is exceeded), the UI would still reflect the correct theme because the DOM attributes are set before the storage call is made.

| Property | Value |
|----------|-------|
| Storage Key | `simple_scraper_theme` |
| Accepted Values | `"light"` or `"dark"` |
| Default (no saved preference) | `"dark"` |
| Default (unrecognized value) | `"dark"` |
| Storage Mechanism | `chrome.storage.local` |
| Fallback Behavior | Any value that is not `"light"` triggers dark theme |

---

## Theme Application Flow

The theme application process follows a strict, deterministic sequence that ensures consistent visual rendering every time the extension's sidebar is opened. Understanding this flow is essential for anyone modifying the theme system or debugging theme-related issues.

1. **DOMContentLoaded Event Fires.** When the sidebar's HTML document has been fully parsed and all deferred scripts have executed, the `DOMContentLoaded` event triggers the initialization sequence. At this point, all DOM elements exist and are accessible, but images and subresources may still be loading. The theme initialization is deliberately placed early in the startup sequence—before any scraping logic or UI panel rendering—so that the correct CSS variables are in effect when the first paint occurs, preventing a flash of the wrong theme.

2. **`ui.initTheme()` is Called.** This function is the single entry point for all theme initialization logic. It is responsible for reading the stored preference, determining which theme should be active, and calling the appropriate application function. The function is idempotent: calling it multiple times has the same effect as calling it once, which is important because the sidebar may be reopened without being fully destroyed and recreated.

3. **Read `simple_scraper_theme` from `chrome.storage.local`.** The `initTheme()` function invokes `chrome.storage.local.get("simple_scraper_theme", callback)` to retrieve the stored preference. Because `chrome.storage.local.get` is asynchronous, the callback pattern ensures that the theme is only applied after the stored value has been successfully retrieved. The callback receives an object where the key `simple_scraper_theme` may or may not be present.

4. **Evaluate the Stored Value.** If the retrieved value is exactly the string `"light"`, the `applyLightTheme()` function is called. In every other case—including when the key is absent (value is `undefined`), when the value is `null`, when the value is an empty string, or when the value is any unrecognized string—the `applyDarkTheme()` function is called. This conservative approach ensures that the extension always renders in a known-good visual state, defaulting to the dark theme as specified in the design requirements.

5. **`applyDarkTheme()` Executes.** This function performs three operations in sequence. First, it sets the `data-theme` attribute to `"dark"` on `document.documentElement` (the `<html>` element), which activates the `[data-theme="dark"]` CSS selector and overrides all root-level custom properties with the dark palette values. Second, it updates the toggle button's icon to ☀️ (sun), signaling to the user that clicking the button will switch to the light theme. Third, it persists the preference by calling `chrome.storage.local.set({ simple_scraper_theme: "dark" })`, ensuring the choice survives browser restarts and extension updates.

6. **`applyLightTheme()` Executes.** This function mirrors `applyDarkTheme()` but applies the opposite visual state. First, it sets the `data-theme` attribute to `"light"` on `document.documentElement`. When `data-theme="light"` is set, the `[data-theme="dark"]` selector no longer matches, so the `:root` default variables (which define the light palette) take effect. Second, it updates the toggle button's icon to 🌙 (moon), indicating that clicking will switch to the dark theme. Third, it persists the preference by calling `chrome.storage.local.set({ simple_scraper_theme: "light" })`.

The entire flow is designed to be atomic and self-correcting. If any step fails or produces an unexpected value, the system gracefully falls back to the dark theme rather than entering an undefined visual state. This robustness is critical for a Chrome extension, which may be opened and closed dozens of times during a browsing session and must present a consistent, professional appearance on every invocation.
