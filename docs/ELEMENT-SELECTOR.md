# Element Selector Mode — Reference

> **Simple Web Scraper** Chrome Extension v1.0.0 · Manifest V3

## Table of Contents

1. [Overview](#overview)
2. [Activation Flow](#activation-flow)
3. [Notification Bar](#notification-bar)
4. [Hover Behavior](#hover-behavior-handleelementmouseover)
5. [Mouse-Out Behavior](#mouse-out-behavior-handleelementmouseout)
6. [Click Selection](#click-selection-handleelementclick)
7. [targetIndex Routing in Sidebar](#targetindex-routing-in-sidebar)
8. [Deactivation](#deactivation)
9. [CSS Selector Generation Algorithm](#css-selector-generation-algorithm)
10. [Helper Functions](#helper-functions)

---

## Overview

The Element Selector is a visual picking tool built into the Simple Web Scraper extension that allows users to identify and auto-generate CSS selectors for page elements simply by clicking on them. Rather than requiring users to manually inspect the DOM and write selector strings by hand — a process that is error-prone and time-consuming — the Element Selector provides an interactive, point-and-click experience that dramatically lowers the barrier to configuring scraping schemas.

When activated, the entire page becomes a live selection surface. As the user moves their mouse across the page, elements are highlighted with a distinct blue border and background, and a floating notification bar at the top of the page provides real-time previews of the CSS selector that would be generated for the currently hovered element. Clicking on an element finalizes the selection, generates a robust CSS selector through a multi-step fallback algorithm, and communicates the result back to the sidebar so that the corresponding input field is populated automatically.

The Element Selector mode is implemented as a cooperative feature between the extension's content script and its sidebar UI. The sidebar owns the schema form with its selector input fields and picker buttons, while the content script owns the DOM-level interaction mechanics — event listeners, visual highlights, selector generation, and notification management. Communication between the two is handled entirely through `window.parent.postMessage`, making the architecture clean and decoupled. This separation ensures that selector logic can evolve independently of the sidebar UI, and vice versa.

---

## Activation Flow

The Element Selector mode is always initiated from the sidebar UI. Each selector input field in the schema form — whether it is the parent selector, card selector, next-button selector, or a column-level selector — has an adjacent 🔍 picker button. Clicking this button triggers the entire activation sequence, which involves cross-frame communication between the sidebar iframe and the content script running in the host page.

The activation sequence proceeds as follows. First, the user clicks the 🔍 picker button next to a selector input field in the sidebar. The sidebar's event handler calls `activateElementSelector(index)`, where `index` is a string identifier that uniquely identifies which input field the result should be routed to. This identifier — referred to as `targetIndex` throughout the codebase — can be either a UUID string (for dynamically created column selectors) or one of several well-known special strings such as `"parent-selector"`, `"card-selector"`, or `"next-button-selector"`.

The sidebar then posts a message to the content script using `window.parent.postMessage` with the payload `{ action: "activateElementSelector", targetIndex: index }`. The content script receives this message inside its `handleSidebarMessages` function, validates the action, and invokes the local `activateElementSelector(targetIndex)` function. If the selector mode is already active when this function is called, it deactivates the existing session first to prevent overlapping states. Once deactivated, the function sets `scraper.selectorMode = true` and stores the `targetIndex` in `scraper.targetSelectorIndex` so that it can be referenced later when the selection is finalized.

The visual and behavioral changes are applied immediately: the page cursor is set to crosshair via `document.body.style.cursor = "crosshair"`, and four capture-phase event listeners are attached to the document — `mouseover`, `mouseout`, `click`, and `keydown`. Using capture phase ensures that the content script's handlers run before any page-level handlers, giving the extension full control over event propagation during selector mode. Finally, a notification bar is inserted at the top of the page to inform the user that selector mode is active and to provide cancel and help controls.

---

## Notification Bar

The notification bar is the primary visual indicator that Element Selector mode is active. It is rendered as a fixed-position element anchored near the top of the viewport, ensuring that it remains visible regardless of scroll position. Its styling is designed to be immediately noticeable without being obtrusive: it sits at `top: 20px`, is centered horizontally within the viewport, and uses a prominent blue background (`#4285F4`) with white text to convey an active, informational state.

The notification bar contains three distinct components. The first is the instruction text — a `<span>` element that communicates the current state to the user. In its default state, the text reads "Click on an element to select it, or press ESC/click ✕ to cancel". When the user hovers over a page element, the text dynamically updates to show a live preview of the generated selector, such as "Click to select: div.product-card:nth-child(3)". This real-time feedback is one of the most valuable aspects of the notification bar, as it allows users to verify that the auto-generated selector will target the correct element before committing to a click.

The second component is the ℹ️ help icon, which provides a tooltip explaining the picker behavior in more detail. This is particularly useful for first-time users who may not be familiar with how the selector mode works. The tooltip typically describes the interaction model: hover to preview, click to select, and ESC or the cancel button to abort. The third component is the ✕ cancel button, which immediately deactivates selector mode when clicked. The cancel button has a subtle hover effect — a semi-transparent white background — to indicate that it is interactive.

When a selection is successfully made, the notification bar undergoes a visual transformation to confirm the action. The background color changes from blue to green (`#2c7d32`), the text updates to "✓ Selected: [selector]" where the selector is shown in full, and the bar receives a brief scale animation that draws the user's attention. This state transition provides clear, unambiguous feedback that the selector has been captured and communicated to the sidebar. The notification is removed from the DOM when `deactivateElementSelector()` is called after the 500ms feedback delay.

---

## Hover Behavior (handleElementMouseOver)

The hover behavior is the core interactive feedback loop of the Element Selector mode. Every time the user moves their mouse over a new element while selector mode is active, the `handleElementMouseOver` function is invoked. This function is registered as a capture-phase event listener on the document, which means it executes before any other mouseover handlers that the page itself may have registered. This priority ensures that the extension's highlighting logic is never preempted or interfered with by the page's own event handling.

The function begins with a guard clause that checks whether the event target is the sidebar iframe (identified by `#simple-scraper-sidebar`) or the notification bar element (`#selector-notification`). If the target matches either of these, the function returns immediately without taking any action. This is critical because the sidebar and notification are part of the extension's own UI, and highlighting or selecting them would be nonsensical — they are not part of the page content that the user wants to scrape.

For valid page elements, the function first stores a reference to the element along with its current inline styles for border, background, and outline. These stored values are essential for the mouse-out behavior, which must restore the element's original appearance. After preserving the original styles, the function calls `generateSelector(event.target)` to produce a CSS selector string for the hovered element. This preview selector is then displayed in the notification bar, updating the instruction text to something like "Click to select: div.product-card:nth-child(3)".

The visual highlight is then applied to the element. Three style properties are set simultaneously: `border: 2px solid #4285F4` creates a solid blue border around the element, `background-color: rgba(66, 133, 244, 0.1)` adds a very subtle blue tint to the element's background, and `outline: 1px dashed #4285F4` provides an additional dashed outline that helps distinguish the highlight from any existing border the element may have. The combination of border and outline ensures visibility even on elements that already have custom borders. Finally, the function calls `event.preventDefault()` and `event.stopPropagation()` to prevent the page from reacting to the hover event, keeping the interaction entirely under the extension's control.

---

## Mouse-Out Behavior (handleElementMouseOut)

The mouse-out behavior is the complement to the hover behavior and is responsible for cleanly reversing all visual changes made during a hover. When the user moves their cursor away from a highlighted element, the `handleElementMouseOut` function is invoked. Like its hover counterpart, it is registered as a capture-phase event listener on the document, ensuring that it runs with maximum priority and is not blocked or delayed by the page's own event handlers.

The first action the function takes is to restore the element's original inline styles. During the hover phase, the function stored the element's original border, background-color, and outline values. Now, those stored values are written back to the element's style object. This restoration is essential for maintaining the page's visual integrity — without it, elements would retain the blue highlight styling even after the cursor moves away, creating a confusing and cluttered visual experience. By carefully saving and restoring only the specific properties that were modified, the function avoids interfering with any other inline styles the element may have had.

After restoring the element's appearance, the function resets the notification bar to its default state. This is accomplished by calling `createNotificationUI(notification)`, which rebuilds the notification's internal content from scratch — resetting the instruction text back to "Click on an element to select it, or press ESC/click ✕ to cancel", restoring the default layout with the help icon and cancel button, and discarding any hover-specific text such as the selector preview. This full reset approach ensures that no stale hover information lingers in the notification bar.

Finally, the function clears the stored element references — both the reference to the previously highlighted element and any associated style data — to prevent stale state from affecting future hover interactions. As with the hover handler, `event.preventDefault()` and `event.stopPropagation()` are called to maintain full control over event propagation and prevent the page from responding to the mouseout event in unexpected ways.

---

## Click Selection (handleElementClick)

The click selection handler is the culmination of the Element Selector interaction. When the user clicks on a highlighted element while in selector mode, the `handleElementClick` function is invoked to finalize the selection, generate the definitive CSS selector, provide visual confirmation, and communicate the result back to the sidebar. This function bridges the content script's DOM-level interaction with the sidebar's schema configuration UI, completing the full loop from user intent to populated form field.

The function begins with the same guard clause used in the hover and mouse-out handlers: if the click target is the sidebar iframe or the notification bar, the function returns immediately. This prevents the user from accidentally selecting the extension's own UI elements. For valid page elements, the function calls `generateSelector(selectedElement)` to produce a CSS selector string. This is the same generation algorithm used during hover previews, but the result here is final — it will be sent to the sidebar and used as the actual selector value in the scraping schema.

Visual feedback is provided in two layers. First, the notification bar transitions to its success state: the background changes to green (`#2c7d32`), the text updates to "✓ Selected: [selector]" showing the full generated selector, and a brief scale animation is applied to draw attention. Second, the clicked element itself receives a momentary green highlight — `background-color: rgba(46, 204, 113, 0.3)` — which provides immediate, spatially relevant confirmation that this particular element was selected. The green color is deliberately distinct from the blue hover highlight to create a clear visual distinction between "previewing" and "selected".

After a 500ms delay — long enough for the user to register both the notification change and the element highlight — the function posts a message to the sidebar using `window.parent.postMessage` with the payload `{ action: "elementSelected", selector, targetIndex }`. The `targetIndex` value, which was stored during activation, tells the sidebar exactly which input field should receive the selector. Immediately after posting the message, `deactivateElementSelector()` is called to tear down selector mode, removing all event listeners, the notification bar, and any lingering highlights. On the sidebar side, the `elementSelected` message is received in `ui.js` by the `handleElementSelected(selector, targetIndex)` function, which locates the matching input field, sets its value to the generated selector, and applies a `.selector-updated` CSS class for one second to provide a highlight animation that confirms the value was updated.

---

## targetIndex Routing in Sidebar

The `targetIndex` string is the routing key that connects a picker button activation in the sidebar to the correct input field receiving the generated selector. Without this routing mechanism, the sidebar would have no way to know which of its potentially many selector fields should be populated when the content script reports an `elementSelected` event. The `targetIndex` is set during activation — when the user clicks a specific 🔍 button — and is preserved in the content script's state until the selection is finalized.

The sidebar's `handleElementSelected(selector, targetIndex)` function uses the `targetIndex` value to perform a lookup and route the selector to the appropriate input field. The routing logic handles two distinct categories of `targetIndex` values: well-known special strings and dynamic UUID strings. The well-known strings correspond to the fixed selector fields that are always present in the schema form, regardless of how many columns the user has defined. The UUID strings correspond to the per-column selector fields, which are created dynamically as the user adds columns to their scraping schema.

The following table documents the complete routing mapping:

| `targetIndex` value        | Target input element                            | Description                                                  |
|----------------------------|------------------------------------------------|--------------------------------------------------------------|
| `"parent-selector"`        | `#parent-selector` input                       | The container element that wraps all repeating items         |
| `"card-selector"`          | `#card-selector` input                         | The repeating element representing a single card/item        |
| `"next-button-selector"`   | `#next-button-selector` input                  | The pagination element for navigating to the next page       |
| UUID string                | `.column-selector` inside `.column-form-row[data-column-id="<UUID>"]` | The selector for a specific data column within each card |

For UUID-based routing, the function queries the DOM for a `.column-form-row` element whose `data-column-id` attribute matches the `targetIndex` UUID, then locates the `.column-selector` input within that row. This approach ensures that even if the user has many columns with similar structures, each selector is routed to the correct field without ambiguity. After setting the input value, the `.selector-updated` class is applied for one second, triggering a CSS animation that visually highlights the updated field and confirms to the user that their selection was successful.

---

## Deactivation

Selector mode can be deactivated through three distinct triggers, all of which converge on the same `deactivateElementSelector()` function. This centralized deactivation ensures consistent cleanup regardless of how the mode was exited, preventing resource leaks such as orphaned event listeners or lingering DOM elements. The three triggers cover all plausible exit paths: the user explicitly cancels, the user completes a selection, or the user presses the keyboard escape key.

The first trigger is the **ESC key**. Two separate keydown listeners watch for this event. The dedicated `handleKeyDown` function checks for `key === "Escape"` or `keyCode === 27`, providing compatibility across browsers and input methods. Additionally, a global `keydown` listener registered in the capture phase at the highest priority ensures that the ESC key is intercepted even if the page or another extension has registered its own keydown handler that calls `stopPropagation()`. This redundancy is intentional — the ESC key is the most natural and expected way for users to dismiss an overlay mode, and it must work reliably in all circumstances.

The second trigger is the **✕ cancel button** in the notification bar. When the user clicks this button, `deactivateElementSelector()` is called directly. This provides a visible, clickable target for users who prefer mouse-driven interaction or may not be aware that ESC is an option. The cancel button is always visible in the notification bar, making it discoverable and accessible regardless of the user's technical background.

The third trigger is a **successful selection**. After the user clicks an element and the 500ms visual feedback delay elapses, `deactivateElementSelector()` is called as the final step of the `handleElementClick` function. This automatic deactivation ensures that selector mode does not persist after a selection has been made, preventing accidental double-selections and returning the page to its normal interactive state as quickly as possible.

The `deactivateElementSelector()` function performs the following cleanup operations in order: it resets `scraper.selectorMode` to `false` and `scraper.targetSelectorIndex` to `null`, restoring the content script's state machine to its idle configuration. It resets `document.body.style.cursor` to `"default"`, removing the crosshair cursor. It removes all four capture-phase event listeners (mouseover, mouseout, click, keydown) from the document, ensuring that the extension no longer intercepts any user interactions. It removes the notification bar element from the DOM entirely. Finally, if a highlighted element still exists — which can happen if the user cancels while hovering over an element — the function restores that element's original border, background-color, and outline values and clears all stored element references. This thorough cleanup guarantees that the page is returned to its exact pre-selector-mode state with no visual artifacts or behavioral side effects.

---

## CSS Selector Generation Algorithm

The `generateSelector(element)` function is the algorithmic heart of the Element Selector mode. Its job is to take an arbitrary DOM element and produce a CSS selector string that uniquely identifies that element within the page. This is a non-trivial problem because web pages vary enormously in structure, naming conventions, and complexity. The algorithm uses a progressive fallback strategy — it starts with the simplest possible selector and incrementally adds specificity until the selector resolves to exactly one element in the DOM, which must be the original target.

### Step 1: Base Selector

The algorithm begins by constructing a base selector from the element's most immediate identifying properties. The starting point is always the element's tag name, converted to lowercase (e.g., `div`, `span`, `a`). If the element has an `id` attribute, it is appended using the `#id` syntax, with the value passed through `escapeCssSelector` to handle characters that are invalid in CSS selectors (such as colons, periods, or brackets, which are common in auto-generated IDs from frameworks).

Next, all CSS class names on the element are collected and filtered through `isValidCssClassName`, which discards any class name that does not conform to the pattern `/^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/`. This filter removes class names that begin with digits, contain special characters, or would otherwise produce invalid or unreliable selectors. Valid class names are appended using `.class1.class2` notation.

The algorithm then examines all attributes on the element. Any attribute with a non-empty value — except `id`, `class`, `style`, and the custom `scraped` attribute — is appended in the form `[attr='value']`. The `scraped` attribute is excluded because it is an internal marker used by the extension itself and would create circular references. Finally, the element's position among its siblings is captured using `:nth-child(n)`. If the element is the first child, `:first-child` is also appended; if it is the last child, `:last-child` is appended as well.

### Step 2: Uniqueness Check

With the base selector constructed, the algorithm checks whether it is sufficient to uniquely identify the element. It does this by passing the selector to `document.querySelectorAll()` and examining the results. If exactly one element matches and that element is the same as the original target (verified by reference equality), the selector is returned immediately. This is the ideal outcome — a concise, readable selector that is also unique.

### Step 3: Parent Scoping

If the base selector alone is not unique, the algorithm escalates by incorporating the element's direct parent. It builds a parent selector using the parent's tag name, ID (if present, with escaping), or class names. The combined selector takes the form `parentSelector > selector`, where the `>` combinator ensures that only direct children are matched, maintaining specificity without over-constraining. This combined selector is tested with `querySelectorAll`, and if it produces exactly one match, it is returned. Parent scoping is often sufficient because many pages use repeating structures within distinct container elements, and the parent provides the necessary context.

### Step 4: Full Path (Up to 3 Levels)

If parent scoping does not yield a unique selector, the algorithm walks further up the DOM tree, building a progressively longer selector path. It ascends up to three levels above the original element. At each level, it constructs a component using the ancestor's tag name combined with its class names, or — if the ancestor has an ID — using just `#id` (since an ID should be globally unique within the document, the loop breaks at this point). The full selector takes the form `level1 > level2 > level3 > selector`, with each level separated by the direct child combinator. After constructing each additional level, the selector is tested against the DOM. If it becomes unique at any point, it is returned immediately.

### Step 5: Positional Fallback

As a last resort, the algorithm falls back to a purely positional selector. It constructs `parentTag > *:nth-child(n+1)`, which selects the nth child of the parent regardless of tag name. This selector is maximally specific in terms of position but makes no assumptions about the element's identity, class, or attributes. If even this selector fails to uniquely identify the element — which would only happen in extremely unusual DOM structures — the algorithm returns just the tag name as a degenerate fallback. While this fallback would not produce a unique selector, it is better than returning an empty string or throwing an error, and it at least provides the user with a starting point that they can refine manually.

---

## Helper Functions

The Element Selector mode relies on several small but critical helper functions that support the main interaction and generation logic. These functions handle concerns such as CSS selector string escaping, class name validation, and notification UI construction. While individually simple, they are essential for the correctness and robustness of the overall feature.

### escapeCssSelector(str)

The `escapeCssSelector` function ensures that arbitrary strings — particularly ID values and attribute values — are safe for use within CSS selector syntax. CSS selectors have strict rules about which characters are allowed unescaped, and many real-world ID and attribute values contain characters such as colons, periods, brackets, and spaces that would break selector parsing if included verbatim. The function first checks whether the native `CSS.escape()` method is available in the browser. This method, part of the CSS Object Model specification, handles all edge cases correctly and is the preferred approach when available. If `CSS.escape()` is not present — which could happen in older browser environments — the function falls back to a manual escaping routine that escapes backslashes (`\`) and single quotes (`'`), making the string safe for use inside single-quoted attribute selectors like `[id='escaped-value']`.

### isValidCssClassName(className)

The `isValidCssClassName` function acts as a gatekeeper for class names that are considered safe for inclusion in generated CSS selectors. It tests each class name against the regular expression `/^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/`. This pattern accepts class names that optionally start with a hyphen, then begin with an underscore or letter, and continue with underscores, letters, digits, or hyphens. It rejects class names that start with a digit (which would be interpreted as a number in CSS syntax), contain characters like `@`, `!`, `.`, `#`, or any other special character that would break selector parsing. This filter is crucial because many JavaScript frameworks and CSS-in-JS libraries generate class names with hash suffixes or special characters that are technically valid in HTML but produce invalid or unreliable CSS selectors. By filtering these out, the algorithm ensures that every generated selector is syntactically valid and can be reliably used with `querySelectorAll`.

### createNotificationUI(notification, message?)

The `createNotificationUI` function is responsible for constructing and reconstructing the internal content of the notification bar. It accepts the notification element itself and an optional custom message parameter. When called without a custom message, it builds the default notification layout: an instruction text span containing "Click on an element to select it, or press ESC/click ✕ to cancel", and an icons container holding the ℹ️ help icon with its tooltip and the ✕ cancel button. When called with a custom message — such as during hover previews or selection confirmation — the instruction text is replaced with the provided message while the icons container remains intact. The cancel button is wired to call `deactivateElementSelector()` directly, and it features a hover effect with a semi-transparent white background to indicate interactivity. The help icon's tooltip provides a concise explanation of the picker's behavior, serving as in-context documentation for users who may be unfamiliar with the feature. This function is called both during initial notification creation and during hover state transitions, making it the single source of truth for the notification bar's content structure.
