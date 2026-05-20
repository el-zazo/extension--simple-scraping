// Content script for Simple Web Scraper extension

// Global variables
// Using window property to prevent redeclaration issues
window.simpleScraper = window.simpleScraper || {};
const scraper = window.simpleScraper;

// Sidebar width constant
const SIDEBAR_WIDTH = 450;

// Initialize properties only if they don't exist
scraper.sidebar = scraper.sidebar || null;
scraper.sidebarInjected = scraper.sidebarInjected || false;
scraper.selectorMode = scraper.selectorMode || false;
scraper.targetSelectorIndex = scraper.targetSelectorIndex || null;
scraper.highlightedElement = scraper.highlightedElement || null;
scraper.originalBorder = scraper.originalBorder || null;
scraper.scrapingActive = scraper.scrapingActive || false;

/**
 * Initializes the content script
 */
function initialize() {
  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "ping") {
      // Respond to ping to indicate content script is loaded
      sendResponse({ success: true });
      return true;
    } else if (message.action === "toggleSidebar") {
      if (!scraper.sidebarInjected) {
        injectSidebar();
        scraper.sidebarInjected = true;
        // Immediately open the sidebar on first toggle after injection
        toggleSidebar();
      } else {
        toggleSidebar();
      }
      sendResponse({ success: true });
    }
    return true;
  });
}

// Add a global document-level event listener for ESC key
document.addEventListener(
  "keydown",
  function (event) {
    if (
      (event.key === "Escape" || event.keyCode === 27) &&
      scraper.selectorMode
    ) {
      console.log("Global ESC key handler triggered");
      event.preventDefault();
      event.stopPropagation();
      deactivateElementSelector();
      return false;
    }
  },
  true
);

// Initialize the content script when loaded
initialize();

// Notify the background script that the content script is ready
try {
  chrome.runtime.sendMessage({ action: "contentScriptReady" });
} catch (_) {
  // Context may be invalidated; safe to ignore
}

/**
 * Handles messages from the sidebar
 * @param {MessageEvent} event - The message event
 */
function handleSidebarMessages(event) {
  // Only process messages from our sidebar
  if (!scraper.sidebar || event.source !== scraper.sidebar.contentWindow) {
    return;
  }

  const message = event.data;

  switch (message.action) {
    case "closeSidebar":
      toggleSidebar();
      break;
    case "deleteSidebar":
      deleteSidebar();
      break;
    case "startScraping":
      startScraping(message.schema);
      break;
    case "stopScraping":
      scraper.scrapingActive = false;
      break;
    case "activateElementSelector":
      activateElementSelector(message.targetIndex);
      break;
    default:
      break;
  }
}

/**
 * Injects the sidebar into the page
 */
function injectSidebar() {
  // Create iframe for the sidebar
  scraper.sidebar = document.createElement("iframe");
  scraper.sidebar.id = "simple-scraper-sidebar";
  scraper.sidebar.src = chrome.runtime.getURL("sidebar/sidebar.html");
  scraper.sidebar.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: ${SIDEBAR_WIDTH}px;
    height: 100%;
    z-index: 100000000;
    border: none;
    box-shadow: 2px 0 5px rgba(0, 0, 0, 0.2);
    transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s cubic-bezier(0.4,0,0.2,1);
    opacity: 0;
    transform: translateX(-${SIDEBAR_WIDTH}px);
    display: none;
  `;

  document.body.appendChild(scraper.sidebar);

  // Add message listener for communication with the sidebar
  window.addEventListener("message", handleSidebarMessages);
}

/**
 * Deletes the sidebar from the page and cleans up listeners/state
 */
function deleteSidebar() {
  // Stop any ongoing scraping so it doesn't continue after sidebar removal
  scraper.scrapingActive = false;

  // If selector mode active, deactivate to restore page styles
  if (scraper.selectorMode) {
    deactivateElementSelector();
  }

  // Remove message listener
  window.removeEventListener("message", handleSidebarMessages);

  // Remove the iframe if present
  if (scraper.sidebar && scraper.sidebar.parentNode) {
    scraper.sidebar.parentNode.removeChild(scraper.sidebar);
  }

  // Reset state
  scraper.sidebar = null;
  scraper.sidebarInjected = false;
}

/**
 * Toggles the sidebar visibility
 */
function toggleSidebar() {
  if (scraper.sidebar) {
    if (
      scraper.sidebar.style.transform === `translateX(-${SIDEBAR_WIDTH}px)` ||
      scraper.sidebar.style.display === "none" ||
      scraper.sidebar.style.opacity === "0"
    ) {
      // Open sidebar: show and animate in
      scraper.sidebar.style.display = "block";
      // Force reflow for transition
      void scraper.sidebar.offsetWidth;
      scraper.sidebar.style.transform = "translateX(0)";
      scraper.sidebar.style.opacity = "1";
    } else {
      // Close sidebar: animate out
      scraper.sidebar.style.transform = `translateX(-${SIDEBAR_WIDTH}px)`;
      scraper.sidebar.style.opacity = "0";
      // Wait for transition, then hide
      setTimeout(() => {
        scraper.sidebar.style.display = "none";
      }, 300); // match transition duration
    }
  }
}

/**
 * Creates notification UI elements
 * @param {HTMLElement} notification - The notification element to populate
 * @param {string} [message] - Optional custom message to display
 */
function createNotificationUI(notification, message) {
  // Clear any existing content
  notification.innerHTML = "";

  // Create main text
  const textSpan = document.createElement("span");
  textSpan.textContent =
    message ||
    "Click on an element to select it, or press ESC/click ✕ to cancel";
  notification.appendChild(textSpan);

  // Create a container for the icons
  const iconsContainer = document.createElement("div");
  iconsContainer.style.cssText = `
    display: flex;
    align-items: center;
    margin-left: 10px;
  `;

  // Create a cancel button
  const cancelButton = document.createElement("button");
  cancelButton.textContent = "✕";
  cancelButton.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 16px;
    cursor: pointer;
    margin-left: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    transition: background-color 0.2s ease;
  `;
  cancelButton.title = "Cancel selection mode";
  cancelButton.addEventListener("click", function (event) {
    console.log("Cancel button clicked, deactivating selector mode");
    event.preventDefault();
    event.stopPropagation();
    deactivateElementSelector();
  });

  // Add hover effect
  cancelButton.addEventListener("mouseover", function () {
    this.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
  });
  cancelButton.addEventListener("mouseout", function () {
    this.style.backgroundColor = "";
  });

  // Create a small help icon with tooltip
  const helpIcon = document.createElement("span");
  helpIcon.textContent = "ℹ️";
  helpIcon.style.cssText = `
    cursor: help;
    font-size: 16px;
  `;
  helpIcon.title =
    "Hover over elements to preview their selectors. Click to select the element and use its selector.";

  // Add icons to container
  iconsContainer.appendChild(helpIcon);
  iconsContainer.appendChild(cancelButton);
  notification.appendChild(iconsContainer);

  return notification;
}

/**
 * Shows a notification during selector mode
 */
function showSelectorNotification() {
  const notification = document.createElement("div");
  notification.id = "selector-notification";
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #4285F4;
    color: white;
    padding: 12px 16px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    font-size: 14px;
    transition: all 0.2s ease;
    max-width: 80%;
    display: flex;
    align-items: center;
    justify-content: space-between;
  `;

  // Create the notification UI
  createNotificationUI(notification);

  document.body.appendChild(notification);
}

/**
 * Removes the selector notification
 */
function removeSelectorNotification() {
  console.log("Removing selector notification");
  const notification = document.getElementById("selector-notification");
  if (notification) {
    notification.remove();
    console.log("Notification element removed");
  } else {
    console.log("No notification element found to remove");
  }
}

/**
 * Activates element selector mode
 * @param {number} targetIndex - The index of the target selector in the schema
 */
function activateElementSelector(targetIndex) {
  console.log(
    "Activating element selector mode for target index:",
    targetIndex
  );

  // First ensure we're not already in selector mode
  if (scraper.selectorMode) {
    deactivateElementSelector();
  }

  // Set selector mode and target index
  scraper.selectorMode = true;
  scraper.targetSelectorIndex = targetIndex;

  // Set cursor to crosshair
  document.body.style.cursor = "crosshair";

  // Add event listeners for element selection
  document.addEventListener("mouseover", handleElementMouseOver, true);
  document.addEventListener("mouseout", handleElementMouseOut, true);
  document.addEventListener("click", handleElementClick, true);

  // Add escape key listener to cancel selection mode
  document.addEventListener("keydown", handleKeyDown, true);

  // Show a notification to the user
  showSelectorNotification();
}

/**
 * Deactivates element selector mode
 */
function deactivateElementSelector() {
  console.log("Deactivating element selector mode");

  // Reset selector mode and target index
  scraper.selectorMode = false;
  scraper.targetSelectorIndex = null;

  // Restore cursor
  document.body.style.cursor = "";

  // Remove event listeners - must use same capture phase parameter (true) as when added
  document.removeEventListener("mouseover", handleElementMouseOver, true);
  document.removeEventListener("mouseout", handleElementMouseOut, true);
  document.removeEventListener("click", handleElementClick, true);
  document.removeEventListener("keydown", handleKeyDown, true);

  // Remove notification and ensure it's gone
  removeSelectorNotification();

  // Reset highlighted element if any
  if (scraper.highlightedElement) {
    // Restore all original styling
    scraper.highlightedElement.style.border = scraper.originalBorder;
    scraper.highlightedElement.style.backgroundColor =
      scraper.originalBackground;
    scraper.highlightedElement.style.outline = scraper.originalOutline;

    // Clear references
    scraper.highlightedElement = null;
    scraper.originalBorder = null;
    scraper.originalBackground = null;
    scraper.originalOutline = null;
  }
}

/**
 * Handles mouseover on elements during selector mode
 * @param {Event} event - The mouseover event
 */
function handleElementMouseOver(event) {
  if (!scraper.selectorMode) return;

  // Prevent highlighting the sidebar or notification
  if (
    event.target === scraper.sidebar ||
    event.target.closest("#simple-scraper-sidebar") ||
    event.target.closest("#selector-notification")
  ) {
    return;
  }

  // Store the current element and its original border and background
  scraper.highlightedElement = event.target;
  scraper.originalBorder = scraper.highlightedElement.style.border;
  scraper.originalBackground = scraper.highlightedElement.style.backgroundColor;
  scraper.originalOutline = scraper.highlightedElement.style.outline;

  // Create a preview of the selector that would be generated
  const previewSelector = generateSelector(event.target);

  // Show selector preview in notification
  const notification = document.getElementById("selector-notification");
  if (notification) {
    notification.textContent = '';
    const label = document.createElement('span');
    label.textContent = 'Click to select: ';
    const code = document.createElement('code');
    code.style.cssText = 'word-break:break-all;white-space:pre-wrap;overflow-wrap:break-word;display:inline;';
    code.textContent = previewSelector;
    notification.appendChild(label);
    notification.appendChild(code);
    notification.style.maxWidth = "80%";
    notification.style.overflow = "visible";
    notification.style.textOverflow = "clip";
    notification.style.whiteSpace = "normal";
  }

  // Highlight the element with more visible styling
  scraper.highlightedElement.style.border = "2px solid #4285F4";
  scraper.highlightedElement.style.backgroundColor = "rgba(66, 133, 244, 0.1)";
  scraper.highlightedElement.style.outline = "1px dashed #4285F4";

  // Prevent default to avoid any unwanted interactions
  event.preventDefault();
  event.stopPropagation();
}

/**
 * Handles mouseout on elements during selector mode
 * @param {Event} event - The mouseout event
 */
function handleElementMouseOut(event) {
  if (!scraper.selectorMode || !scraper.highlightedElement) return;

  // Restore the original styling
  scraper.highlightedElement.style.border = scraper.originalBorder;
  scraper.highlightedElement.style.backgroundColor = scraper.originalBackground;
  scraper.highlightedElement.style.outline = scraper.originalOutline;

  // Reset the notification to default text
  const notification = document.getElementById("selector-notification");
  if (notification) {
    // Reset the notification UI
    createNotificationUI(notification);

    // Reset max width
    notification.style.maxWidth = "";
  }

  // Clear the element references
  scraper.highlightedElement = null;
  scraper.originalBorder = null;
  scraper.originalBackground = null;
  scraper.originalOutline = null;

  // Prevent default
  event.preventDefault();
  event.stopPropagation();
}

/**
 * Handles click on elements during selector mode
 * @param {Event} event - The click event
 */
function handleElementClick(event) {
  if (!scraper.selectorMode) return;

  // Prevent clicking on the sidebar or notification
  if (
    event.target === scraper.sidebar ||
    event.target.closest("#simple-scraper-sidebar") ||
    event.target.closest("#selector-notification")
  ) {
    return;
  }

  // Get the selected element
  const selectedElement = event.target;

  // Generate a CSS selector for the element
  const selector = generateSelector(selectedElement);

  // Show a brief success notification before deactivating
  const notification = document.getElementById("selector-notification");
  if (notification) {
    notification.textContent = '';
    const check = document.createElement('span');
    check.style.color = '#8efa8e';
    check.textContent = '✓';
    const selLabel = document.createElement('span');
    selLabel.textContent = ' Selected: ';
    const selCode = document.createElement('code');
    selCode.textContent = selector;
    notification.appendChild(check);
    notification.appendChild(selLabel);
    notification.appendChild(selCode);
    notification.style.backgroundColor = "#2c7d32";

    // Flash effect to indicate success
    setTimeout(() => {
      notification.style.transform = "translateX(-50%) scale(1.05)";
      setTimeout(() => {
        notification.style.transform = "translateX(-50%) scale(1)";
      }, 150);
    }, 0);
  }

  // Briefly highlight the selected element with a success color
  const originalBg = selectedElement.style.backgroundColor;
  selectedElement.style.backgroundColor = "rgba(46, 204, 113, 0.3)";
  selectedElement.style.transition = "background-color 0.3s ease";

  // Send the selector back to the sidebar after a short delay for visual feedback
  setTimeout(() => {
    // Send the selector back to the sidebar
    if (scraper.sidebar && scraper.sidebar.contentWindow) {
      scraper.sidebar.contentWindow.postMessage(
        {
          action: "elementSelected",
          selector: selector,
          targetIndex: scraper.targetSelectorIndex,
        },
        "*"
      );
    } else {
      console.error("Sidebar not available for sending message");
    }

    // Deactivate selector mode
    deactivateElementSelector();
  }, 500); // Short delay for visual feedback

  // Prevent default to avoid any unwanted interactions
  event.preventDefault();
  event.stopPropagation();
}

/**
 * Handles keydown events during selector mode
 * @param {Event} event - The keydown event
 */
function handleKeyDown(event) {
  console.log(
    "Key pressed:",
    event.key,
    "Selector mode:",
    scraper.selectorMode
  );

  // If Escape key is pressed, cancel selector mode
  if (
    (event.key === "Escape" || event.keyCode === 27) &&
    scraper.selectorMode
  ) {
    console.log("ESC key pressed, deactivating selector mode");
    // Prevent default and stop propagation before deactivating
    event.preventDefault();
    event.stopPropagation();
    // Deactivate element selector
    deactivateElementSelector();
    return false;
  }
}

/**
 * Validates if a string is a valid CSS class name
 * @param {string} className - The class name to validate
 * @returns {boolean} - Whether the class name is valid
 */
function isValidCssClassName(className) {
  // CSS identifiers can't start with a digit, two hyphens, or hyphen followed by digit
  // They also can't contain certain special characters
  return /^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test(className);
}

/**
 * Escapes special characters in CSS selectors
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string
 */
function escapeCssSelector(str) {
  // Escape special characters in CSS selectors
  if (!str) return str;

  // Use native CSS.escape if available (handles all edge cases correctly)
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(str);
  }

  // Fallback: escape for use inside single-quoted CSS attribute values
  // In single-quoted strings, only backslash and single-quote need escaping
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Generates a CSS selector for an element
 * @param {Element} element - The element to generate a selector for
 * @returns {string} - The generated CSS selector
 */
function generateSelector(element) {
  // Start with tag name
  let selector = element.tagName.toLowerCase();

  // Include id (do not early return) for a complete selector
  if (element.id) {
    selector += `#${escapeCssSelector(element.id)}`;
  }

  // Include all valid classes
  if (element.className && typeof element.className === "string") {
    const classes = element.className.trim().split(/\s+/).filter(Boolean);
    const validClasses = classes.filter(isValidCssClassName);
    if (validClasses.length > 0) {
      selector += "." + validClasses.join(".");
    }
  }

  // Include all non-empty attributes except id/class/style for completeness
  if (element.attributes && element.attributes.length > 0) {
    for (const attr of Array.from(element.attributes)) {
      const name = attr.name;
      const value = attr.value;
      if (!name || name === "id" || name === "class" || name === "style" || name === "scraped")
        continue;
      if (value == null || String(value).length === 0) continue;
      selector += `[${name}='${escapeCssSelector(String(value))}']`;
    }
  }

  // Append positional pseudo-classes relative to parent (CSS standard ones)
  if (element.parentElement) {
    const siblings = Array.from(element.parentElement.children);
    const index = siblings.indexOf(element);
    if (index !== -1) {
      selector += `:nth-child(${index + 1})`;
      if (index === 0) selector += `:first-child`;
      if (index === siblings.length - 1) selector += `:last-child`;
    }
  }

  // Check if the selector is valid and unique
  try {
    const matchingElements = document.querySelectorAll(selector);
    if (matchingElements.length === 1 && matchingElements[0] === element) {
      return selector;
    }
  } catch (error) {
    console.error("Invalid selector generated:", selector, error);
    // Fallback to tag + first valid class
    selector = element.tagName.toLowerCase();
    if (element.className && typeof element.className === "string") {
      const classes = element.className.trim().split(/\s+/);
      const validClass = classes.find(isValidCssClassName);
      if (validClass) selector += "." + validClass;
    }
    try {
      document.querySelector(selector);
    } catch (fallbackError) {
      console.error("Invalid fallback selector:", selector, fallbackError);
      selector = element.tagName.toLowerCase();
    }
  }

  // If not unique, try to scope with direct parent
  if (element.parentElement) {
    const parent = element.parentElement;
    let parentSelector = parent.tagName.toLowerCase();
    if (parent.id) {
      parentSelector = `#${escapeCssSelector(parent.id)}`;
    } else if (parent.className && typeof parent.className === "string") {
      const parentClasses = parent.className
        .trim()
        .split(/\s+/)
        .filter(isValidCssClassName);
      if (parentClasses.length > 0)
        parentSelector += "." + parentClasses.join(".");
    }
    const combinedSelector = `${parentSelector} > ${selector}`;
    try {
      const matchingElements = document.querySelectorAll(combinedSelector);
      if (matchingElements.length === 1 && matchingElements[0] === element) {
        return combinedSelector;
      }
    } catch (error) {
      console.error("Invalid combined selector:", combinedSelector, error);
    }
  }

  // Build a short full path (up to 3 levels)
  let currentElement = element;
  let fullPathSelector = selector;
  let levels = 0;
  while (currentElement.parentElement && levels < 3) {
    currentElement = currentElement.parentElement;
    let parentTag = currentElement.tagName.toLowerCase();
    if (currentElement.id) {
      fullPathSelector = `#${escapeCssSelector(
        currentElement.id
      )} > ${fullPathSelector}`;
      break;
    }
    if (
      currentElement.className &&
      typeof currentElement.className === "string"
    ) {
      const parentClasses = currentElement.className
        .trim()
        .split(/\s+/)
        .filter(isValidCssClassName);
      if (parentClasses.length > 0) parentTag += "." + parentClasses.join(".");
    }
    fullPathSelector = `${parentTag} > ${fullPathSelector}`;
    levels++;
  }

  try {
    document.querySelector(fullPathSelector);
    return fullPathSelector;
  } catch (error) {
    console.error("Invalid full path selector:", fullPathSelector, error);
    // Last resort: purely positional under parent
    try {
      if (element.parentElement) {
        const parent = element.parentElement;
        const parentTag = parent.tagName.toLowerCase();
        const index = Array.from(parent.children).indexOf(element);
        if (index !== -1) {
          const positionSelector = `${parentTag} > *:nth-child(${index + 1})`;
          document.querySelector(positionSelector);
          return positionSelector;
        }
      }
    } catch (finalError) {
      console.error("Failed to create any valid selector", finalError);
    }
    return element.tagName.toLowerCase();
  }
}

/**
 * Clears the "scraped" attribute from all elements on the page
 */
function clearScrapedMarkers() {
  try {
    const markedElements = document.querySelectorAll('[scraped="true"]');
    markedElements.forEach((el) => {
      try {
        el.removeAttribute("scraped");
      } catch (_) { }
    });
  } catch (error) {
    console.error("Error clearing scraped markers:", error);
  }
}

/**
 * Starts scraping based on the provided schema
 */
function startScraping(schema) {
  // Clear any existing "scraped" markers before starting a new session
  clearScrapedMarkers();

  // Decide scrolling vs pagination vs single-page
  if (schema && schema.enableScrolling) {
    startScrapingWithScrolling(schema);
    return;
  }
  const hasPagination =
    schema &&
    (schema.maxPages > 1 ||
      (schema.nextButtonSelector && schema.nextButtonSelector.trim() !== ""));
  if (hasPagination) {
    startScrapingMultiPage(schema);
  } else {
    // Fallback to single page scrape and send once
    try {
      const { results, diagnostics } = scrapeCurrentPageDetailed(schema);
      if (scraper.sidebar && scraper.sidebar.contentWindow) {
        scraper.sidebar.contentWindow.postMessage(
          { action: "scrapingResults", results, diagnostics },
          "*"
        );
        scraper.sidebar.contentWindow.postMessage(
          { action: "scrapingDone" },
          "*"
        );
      }
    } catch (error) {
      if (scraper.sidebar && scraper.sidebar.contentWindow) {
        scraper.sidebar.contentWindow.postMessage(
          { action: "scrapingError", error: error.message },
          "*"
        );
      }
    }
  }
}

function scrapeCurrentPageDetailed(schema) {
  const results = [];
  const diagnostics = [];
  const columns = schema.columns || [];
  const parentSelector = (schema.parentSelector || "").trim();
  const cardSelector = (schema.cardSelector || "").trim();

  // Record presence of selectors
  diagnostics.push(
    parentSelector
      ? "Parent selector provided."
      : "Parent selector not provided."
  );
  diagnostics.push(
    cardSelector ? "Card selector provided." : "Card selector not provided."
  );

  let cards = [];
  if (parentSelector && cardSelector) {
    const parent = safeQuerySelector(parentSelector);
    if (parent) {
      diagnostics.push("Parent element found.");
      try {
        cards = Array.from(parent.querySelectorAll(cardSelector));
      } catch (e) {
        diagnostics.push("Card selector invalid under parent.");
      }
    } else {
      diagnostics.push("Parent element NOT found.");
    }
  } else if (cardSelector) {
    try {
      cards = safeQuerySelectorAll(cardSelector);
    } catch (_) { }
  }

  if (cardSelector) {
    diagnostics.push(`Cards found: ${cards.length}.`);
  }

  if (cards.length > 0) {
    cards = cards.filter((card) => card && card.getAttribute("scraped") !== "true");
    diagnostics.push(`Cards to process (excluding already scraped): ${cards.length}.`);
    diagnostics.push(
      "Using card-based scraping (iterate cards and query columns inside each card)."
    );
    cards.forEach((card) => {
      const rowData = {};
      columns.forEach((column) => {
        let value = "";
        try {
          if (column.many_values) {
            const elements = Array.from(card.querySelectorAll(column.selector));
            value = elements
              .map((el) => extractValue(el, column))
              .filter((v) => v !== null && v !== undefined && v !== "");
          } else {
            const element = card.querySelector(column.selector);
            if (element) {
              value = extractValue(element, column);
            }
          }
        } catch (error) {
          console.error(
            `Error finding element for column ${column.name} in card:`,
            error
          );
        }
        rowData[column.name] = value;
      });
      results.push(rowData);
      try { card.setAttribute("scraped", "true"); } catch (_) { }
    });
  } else {
    diagnostics.push("No cards found. Falling back to non-card scraping.");
    const hasMultiple = columns.some((col) => col.multiple_elements);
    diagnostics.push(
      hasMultiple
        ? "Columns marked as multiple elements exist."
        : "No columns marked as multiple elements."
    );

    if (hasMultiple) {
      // Find all possible elements for each column
      const elementsPerColumn = columns.map((column) => {
        return {
          column,
          elements: safeQuerySelectorAll(column.selector),
        };
      });

      // Use the column with multiple_elements as the base for iteration
      const baseColumn = elementsPerColumn.find(
        (item) => item.column.multiple_elements
      );
      if (baseColumn) {
        diagnostics.push(
          `Base column for iteration: ${baseColumn.column.name} (${baseColumn.elements.length} elements).`
        );
      }

      if (baseColumn && baseColumn.elements.length > 0) {
        baseColumn.elements.forEach((baseElement, index) => {
          const rowData = {};

          columns.forEach((column) => {
            let value = "";

            if (
              column.multiple_elements &&
              column.selector === baseColumn.column.selector
            ) {
              // For the base column, use the current element
              value = extractValue(baseElement, column);
            } else if (column.multiple_elements) {
              // For other multiple element columns, use the corresponding element at the same index
              const columnElements = safeQuerySelectorAll(column.selector);
              if (columnElements.length > index) {
                value = extractValue(columnElements[index], column);
              }
            } else {
              // For non-multiple columns, use their own selectors to find elements
              const singleElement = safeQuerySelector(column.selector);
              if (singleElement) {
                value = extractValue(singleElement, column);
              }
            }

            rowData[column.name] = value;
          });

          results.push(rowData);
        });
        diagnostics.push(
          `Rows produced via multiple-elements fallback: ${results.length}.`
        );
      } else {
        diagnostics.push(
          "No elements found for base multiple column. No rows produced."
        );
      }
    } else {
      // For schemas without multiple elements, just extract each column once
      let anyElementFound = false;
      const rowData = {};
      columns.forEach((column) => {
        const element = safeQuerySelector(column.selector);
        if (element) {
          rowData[column.name] = extractValue(element, column);
          anyElementFound = true;
        } else {
          rowData[column.name] = "";
        }
      });
      if (anyElementFound) {
        results.push(rowData);
        diagnostics.push("Single-row extraction produced 1 row.");
      } else {
        diagnostics.push(
          "No elements found for any column in single extraction."
        );
      }
    }
  }

  return { results, diagnostics };
}

// Backwards-compatible wrapper returning only results
function scrapeCurrentPage(schema) {
  const { results } = scrapeCurrentPageDetailed(schema);
  return results;
}

async function startScrapingMultiPage(schema) {
  try {
    scraper.scrapingActive = true;
    const maxPages = Math.max(1, parseInt(schema.maxPages || 1, 10));
    const delayMs = Math.max(0, parseInt(schema.nextDelayMs || 0, 10));
    const nextSelector = (schema.nextButtonSelector || "").trim();

    for (let pageIndex = 1; pageIndex <= maxPages; pageIndex++) {
      if (!scraper.scrapingActive) break;

      // Scrape current page
      const { results: pageResults, diagnostics } =
        scrapeCurrentPageDetailed(schema);
      if (scraper.sidebar && scraper.sidebar.contentWindow) {
        scraper.sidebar.contentWindow.postMessage(
          {
            action: "scrapingProgress",
            results: pageResults,
            diagnostics,
            pageIndex,
            totalPages: maxPages,
          },
          "*"
        );
      }

      // If last page planned, break
      if (pageIndex >= maxPages) break;

      // Click next button if selector provided
      if (nextSelector) {
        const btn = safeQuerySelector(nextSelector);
        if (btn) {
          btn.click();
        } else {
          // No next button found; stop early
          break;
        }
      } else {
        // No pagination selector, nothing to click
        break;
      }

      // Wait for delay
      if (delayMs > 0) {
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  } catch (error) {
    if (scraper.sidebar && scraper.sidebar.contentWindow) {
      scraper.sidebar.contentWindow.postMessage(
        { action: "scrapingError", error: error.message },
        "*"
      );
    }
  } finally {
    scraper.scrapingActive = false;
    if (scraper.sidebar && scraper.sidebar.contentWindow) {
      scraper.sidebar.contentWindow.postMessage(
        { action: "scrapingDone" },
        "*"
      );
    }
  }
}

// Scrolling-based scraping for infinite/dynamic lists
async function startScrapingWithScrolling(schema) {
  try {
    scraper.scrapingActive = true;
    const parentSelector = (schema.parentSelector || "").trim();
    const cardSelector = (schema.cardSelector || "").trim();
    const scrollByPx = Math.max(1, parseInt(schema.scrollByPx || 1000, 10));

    // Treat 0 or empty as "not set" and fall back to 1000ms
    const rawPauseMs = parseInt(schema.scrollPauseMs, 10);
    const pauseMs = Number.isFinite(rawPauseMs) && rawPauseMs !== 0
      ? Math.max(0, rawPauseMs)
      : 1000;

    // Default max steps: scroll to end of page when empty or 0, using page height / scrollByPx
    const rawMaxSteps = parseInt(schema.maxScrollSteps, 10);
    const maxSteps = Number.isFinite(rawMaxSteps) && rawMaxSteps > 0
      ? rawMaxSteps
      : Math.max(1, Math.ceil(document.body.scrollHeight / scrollByPx));

    // Rely on scraped="true" attribute to avoid duplicates across steps/runs

    for (let step = 1; step <= maxSteps; step++) {
      if (!scraper.scrapingActive) break;

      const diagnostics = [];
      const pageResults = [];
      const columns = schema.columns || [];

      let cards = [];
      if (parentSelector && cardSelector) {
        const parent = safeQuerySelector(parentSelector);
        if (parent) {
          try {
            cards = Array.from(parent.querySelectorAll(cardSelector));
          } catch (_) { }
        }
      } else if (cardSelector) {
        try {
          cards = safeQuerySelectorAll(cardSelector);
        } catch (_) { }
      }

      // Exclude cards already marked as scraped in prior runs/steps
      cards = cards.filter((card) => card && card.getAttribute("scraped") !== "true");

      diagnostics.push(
        `Scrolling step ${step}/${maxSteps}. Visible cards: ${cards.length}.`
      );

      for (const card of cards) {
        const rowData = {};
        columns.forEach((column) => {
          let value = "";
          try {
            if (column.many_values) {
              const elements = Array.from(card.querySelectorAll(column.selector));
              value = elements
                .map((el) => extractValue(el, column))
                .filter((v) => v !== null && v !== undefined && v !== "");
            } else {
              const element = card.querySelector(column.selector);
              if (element) {
                value = extractValue(element, column);
              }
            }
          } catch (_) { }
          rowData[column.name] = value;
        });
        pageResults.push(rowData);

        // Mark card as scraped so it won't be reprocessed on next steps/runs
        try { card.setAttribute("scraped", "true"); } catch (_) { }
      }

      if (
        scraper.sidebar &&
        scraper.sidebar.contentWindow &&
        pageResults.length > 0
      ) {
        scraper.sidebar.contentWindow.postMessage(
          {
            action: "scrapingProgress",
            results: pageResults,
            diagnostics,
            pageIndex: step,
            totalPages: maxSteps,
          },
          "*"
        );
      }

      // Scroll and wait for new content to load/mount
      window.scrollBy(0, scrollByPx);
      if (pauseMs > 0) {
        await new Promise((res) => setTimeout(res, pauseMs));
      }
    }
  } catch (error) {
    if (scraper.sidebar && scraper.sidebar.contentWindow) {
      scraper.sidebar.contentWindow.postMessage(
        { action: "scrapingError", error: error.message },
        "*"
      );
    }
  } finally {
    scraper.scrapingActive = false;
    if (scraper.sidebar && scraper.sidebar.contentWindow) {
      scraper.sidebar.contentWindow.postMessage(
        { action: "scrapingDone" },
        "*"
      );
    }
  }
}

/**
 * Extracts value from an element based on column configuration
 * @param {Element} element - The element to extract value from
 * @param {Object} column - The column configuration
 * @returns {string} - The extracted value
 */
function extractValue(element, column) {
  if (!element) return "";

  // First extract the base value according to the column type
  let extractedValue = "";

  switch (column.type) {
    case "text":
      extractedValue = element.textContent.trim();
      break;
    case "html":
      extractedValue = element.innerHTML.trim();
      break;
    case "attribute":
      extractedValue = element.getAttribute(column.attribute_name) || "";
      break;
    case "href":
      extractedValue = element.href || "";
      break;
    case "src":
      extractedValue = element.src || "";
      break;
    case "style":
      // Extract value from computed style
      const computedStyle = window.getComputedStyle(element);
      const styleProp = column.style_property || "";
      if (styleProp) {
        extractedValue = computedStyle.getPropertyValue(styleProp).trim() || "";
      }
      break;
    default:
      extractedValue = element.textContent.trim();
  }

  // Then apply RegExp if specified
  if (column.use_regexp && column.regexp_pattern) {
    try {
      const regexpPattern = column.regexp_pattern;

      // Check if the pattern is enclosed in forward slashes with optional flags
      // This indicates it's already in RegExp literal format like /pattern/flags
      let regex;
      const regexLiteralMatch = regexpPattern.match(/^\/(.+)\/([gimuy]*)$/);

      if (regexLiteralMatch) {
        // If it's in /pattern/flags format, extract the pattern and flags
        const pattern = regexLiteralMatch[1];
        const flags = regexLiteralMatch[2];
        regex = new RegExp(pattern, flags);
      } else {
        // Otherwise, use the pattern as is
        regex = new RegExp(regexpPattern);
      }

      const match = extractedValue.match(regex);
      // If there's a match and it has captured groups (parentheses in the regex), return the first captured group
      // Otherwise return the whole match or the original value if no match
      return match ? (match[1] ? match[1] : match[0]) : extractedValue;
    } catch (error) {
      console.error("RegExp extraction error:", error);
      return extractedValue;
    }
  }

  return extractedValue;
}

/**
 * Safely queries the DOM for an element
 * @param {string} selector - CSS selector to query
 * @returns {Element|null} - The found element or null
 */
function safeQuerySelector(selector) {
  try {
    return document.querySelector(selector);
  } catch (error) {
    console.error(`Error querying selector ${selector}:`, error);
    return null;
  }
}

/**
 * Safely queries the DOM for multiple elements
 * @param {string} selector - CSS selector to query
 * @returns {Array} - Array of found elements or empty array
 */
function safeQuerySelectorAll(selector) {
  try {
    return Array.from(document.querySelectorAll(selector));
  } catch (error) {
    console.error(`Error querying selector ${selector}:`, error);
    return [];
  }
}

/**
 * Safely adds an event listener to an element
 * @param {Element} element - The element to add the listener to
 * @param {string} eventType - The event type to listen for
 * @param {Function} callback - The callback function
 * @param {boolean|Object} options - Event listener options
 */
function safeAddEventListener(element, eventType, callback, options = false) {
  if (element && typeof element.addEventListener === "function") {
    element.addEventListener(eventType, callback, options);
  }
}

/**
 * Safely removes an event listener from an element
 * @param {Element} element - The element to remove the listener from
 * @param {string} eventType - The event type to remove
 * @param {Function} callback - The callback function
 * @param {boolean|Object} options - Event listener options
 */
function safeRemoveEventListener(
  element,
  eventType,
  callback,
  options = false
) {
  if (element && typeof element.removeEventListener === "function") {
    element.removeEventListener(eventType, callback, options);
  }
}

// Initialize the content script when the page is loaded
document.addEventListener("DOMContentLoaded", initialize);
