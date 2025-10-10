// UI-related functions for Simple Web Scraper extension
import { uuidv4 } from "./utils.js";
import * as storage from "./storage.js";

// DOM Elements
const schemasList = document.getElementById("schemas-list");
const emptySchemas = document.getElementById("empty-schemas");
const schemaFormModal = document.getElementById("schema-form-modal");
const schemaFormContainer = document.getElementById("schema-form-container");
const schemaForm = document.getElementById("schema-form");
const schemaFormTitle = document.getElementById("schema-form-title");
const columnsContainer = document.getElementById("columns-container");
const resultsModal = document.getElementById("results-modal");
const resultsContainer = document.getElementById("results-container");
const resultsTableContainer = document.getElementById("results-table-container");
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");

// Theme constants
const THEME_KEY = "simple_scraper_theme";
const LIGHT_THEME = "light";
const DARK_THEME = "dark";

/**
 * Initialize theme based on saved preference or default to dark theme
 */
export function initTheme() {
  // Check for saved theme preference
  storage.get(THEME_KEY, (result) => {
    const savedTheme = result[THEME_KEY];
    if (savedTheme === LIGHT_THEME) {
      applyLightTheme();
    } else {
      // Default to dark theme if no preference is saved or it's already set to dark
      applyDarkTheme();
    }
  });
}

/**
 * Create a schema card element
 * @param {Object} schema - Schema object
 * @returns {HTMLElement} - Schema card element
 * @param {boolean} disabled
 */
function setGlobalControlsDisabled(disabled) {
  const idsToToggle = [
    'import-schemas',
    'export-schemas',
    'add-schema',
    'cancel-schema-form',
    'add-column',
    'export-button',
    'pages-button',
    'back-to-schemas',
    'export-results',
    'export-json',
    'select-all-pages'
  ];

  idsToToggle.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !!disabled;
  });

  // Disable selector pickers (in form)
  document.querySelectorAll('.selector-picker-button').forEach((btn) => {
    btn.disabled = !!disabled;
  });

  // Do NOT disable theme toggle or close sidebar as per requirement

  // Close any open dropdowns when disabling
  if (disabled) {
    const exportOptions = document.getElementById('export-options');
    if (exportOptions) exportOptions.classList.remove('show');
    const pagesOptions = document.getElementById('pages-options');
    if (pagesOptions) pagesOptions.classList.remove('show');
    const exportArrow = document.querySelector('#export-button .dropdown-arrow');
    if (exportArrow) exportArrow.classList.remove('rotated');
    const pagesArrow = document.querySelector('#pages-button .dropdown-arrow');
    if (pagesArrow) pagesArrow.classList.remove('rotated');
  }
}

/**
 * Reset all schema cards' start/stop buttons to default Start state
 */
export function resetScrapingUIState() {
  const allCards = document.querySelectorAll(".schema-card");
  allCards.forEach((card) => {
    const schemaId = card.dataset.schemaId;
    const btn = card.querySelector(".start-scraping");
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = "Start Scraping";
    btn.classList.remove("stop-button");
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener("click", () => {
      currentHandlers && currentHandlers.startScraping && currentHandlers.startScraping(schemaId);
    });

    // Re-enable edit/delete buttons
    const editBtn = card.querySelector('.edit-schema');
    const delBtn = card.querySelector('.delete-schema');
    if (editBtn) editBtn.disabled = false;
    if (delBtn) delBtn.disabled = false;
  });

  // Re-enable global controls
  setGlobalControlsDisabled(false);
}

/**
 * Toggle UI state for scraping (start/stop and disable others)
 * @param {string} schemaId
 * @param {boolean} running
 */
export function setScrapingUIState(schemaId, running) {
  // Disable/enable all start buttons
  const allCards = document.querySelectorAll(".schema-card");
  allCards.forEach((card) => {
    const btn = card.querySelector(".start-scraping");
    if (!btn) return;
    const isTarget = card.dataset.schemaId === schemaId;
    if (running) {
      if (isTarget) {
        // Switch to Stop
        btn.textContent = "Stop Scraping";
        btn.classList.add("stop-button");
        // Remove previous listeners by replacing node
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener("click", () => {
          currentHandlers && currentHandlers.stopScraping && currentHandlers.stopScraping(schemaId);
        });
      } else {
        btn.disabled = true;
      }

      // Disable edit/delete for all cards (including active one)
      const editBtn = card.querySelector('.edit-schema');
      const delBtn = card.querySelector('.delete-schema');
      if (editBtn) editBtn.disabled = true;
      if (delBtn) delBtn.disabled = true;
    } else {
      // Reset to Start
      btn.disabled = false;
      if (isTarget) {
        btn.textContent = "Start Scraping";
        btn.classList.remove("stop-button");
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener("click", () => {
          currentHandlers && currentHandlers.startScraping && currentHandlers.startScraping(schemaId);
        });
      }

      // Re-enable edit/delete when not running
      const editBtn = card.querySelector('.edit-schema');
      const delBtn = card.querySelector('.delete-schema');
      if (editBtn) editBtn.disabled = false;
      if (delBtn) delBtn.disabled = false;
    }
  });

  // Toggle global controls
  setGlobalControlsDisabled(!!running);
}

/**
 * Apply dark theme to the UI
 */
function applyDarkTheme() {
  document.documentElement.setAttribute("data-theme", DARK_THEME);
  themeIcon.textContent = "☀️";
  storage.set({ [THEME_KEY]: DARK_THEME });
}

/**
 * Apply light theme to the UI
 */
function applyLightTheme() {
  document.documentElement.setAttribute("data-theme", LIGHT_THEME);
  themeIcon.textContent = "🌙";
  storage.set({ [THEME_KEY]: LIGHT_THEME });
}

/**
 * Toggle between light and dark theme
 */
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  if (currentTheme === DARK_THEME) {
    applyLightTheme();
  } else {
    applyDarkTheme();
  }
}

/**
 * Set up event listeners for UI elements
 * @param {Object} handlers - Object containing event handler functions
 */
export function setupEventListeners(handlers) {
  // Theme toggle button
  themeToggle.addEventListener("click", toggleTheme);

  // Minimize sidebar button
  const minimizeBtn = document.getElementById("minimize-sidebar");
  if (minimizeBtn) {
    minimizeBtn.addEventListener("click", () => {
      window.parent.postMessage({ action: "closeSidebar" }, "*");
    });
  }

  // Delete sidebar button
  const deleteBtn = document.getElementById("delete-sidebar");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      window.parent.postMessage({ action: "deleteSidebar" }, "*");
    });
  }

  // Add schema button
  document.getElementById("add-schema").addEventListener("click", () => {
    handlers.showSchemaForm();
  });

  // Schema search input
  const schemaSearch = document.getElementById("schema-search");
  if (schemaSearch) {
    schemaSearch.addEventListener("input", (e) => {
      const term = e.target.value || "";
      handlers.setSchemaFilter && handlers.setSchemaFilter(term);
    });
  }

  // Schema sort dropdown
  const schemaSort = document.getElementById("schema-sort");
  if (schemaSort) {
    schemaSort.addEventListener("change", (e) => {
      const value = e.target.value;
      handlers.setSchemaSort && handlers.setSchemaSort(value);
    });
  }

  // Cancel schema form button
  document.getElementById("cancel-schema-form").addEventListener("click", () => {
    handlers.hideSchemaForm();
  });

  // Add column button
  document.getElementById("add-column").addEventListener("click", () => {
    handlers.addColumnToForm();
  });

  // Delegate event listener for selector picker buttons
  document.addEventListener("click", (e) => {
    if (e.target.closest(".selector-picker-button")) {
      const button = e.target.closest(".selector-picker-button");
      const index = button.dataset.index;
      handlers.activateElementSelector(index);
    }
  });

  // Schema form submission
  schemaForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handlers.saveSchemaForm();
  });

  // Back to schemas button
  document.getElementById("back-to-schemas").addEventListener("click", () => {
    handlers.hideResultsView();
  });

  // Export dropdown buttons
  document.getElementById("export-results").addEventListener("click", () => {
    handlers.exportResults();
    document.getElementById("export-options").classList.remove("show");
    document.querySelector("#export-button .dropdown-arrow").classList.remove("rotated");
  });

  document.getElementById("export-json").addEventListener("click", () => {
    handlers.exportAsJson();
    document.getElementById("export-options").classList.remove("show");
    document.querySelector("#export-button .dropdown-arrow").classList.remove("rotated");
  });

  // Close export dropdown when clicking outside
  document.addEventListener("click", (e) => {
    const exportButton = document.getElementById("export-button");
    const exportDropdown = exportButton ? exportButton.closest(".export-dropdown") : null;
    const exportOptions = document.getElementById("export-options");
    const dropdownArrow = document.querySelector("#export-button .dropdown-arrow");

    if (exportDropdown && !exportDropdown.contains(e.target) && exportOptions.classList.contains("show")) {
      exportOptions.classList.remove("show");
      dropdownArrow && dropdownArrow.classList.remove("rotated");
    }
  });

  // Toggle export dropdown when clicking the export button
  document.getElementById("export-button").addEventListener("click", (e) => {
    e.stopPropagation();
    const exportOptions = document.getElementById("export-options");
    const dropdownArrow = document.querySelector("#export-button .dropdown-arrow");

    exportOptions.classList.toggle("show");
    dropdownArrow.classList.toggle("rotated", exportOptions.classList.contains("show"));
  });

  // Pages dropdown basic toggle (keeps it responsive even before results handlers are attached)
  const pagesButton = document.getElementById("pages-button");
  const pagesOptions = document.getElementById("pages-options");
  if (pagesButton && pagesOptions) {
    pagesButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const arrow = pagesButton.querySelector(".dropdown-arrow");
      pagesOptions.classList.toggle("show");
      arrow && arrow.classList.toggle("rotated", pagesOptions.classList.contains("show"));
    });
    // Close when clicking outside
    document.addEventListener("click", (e) => {
      const container = document.querySelector(".pages-dropdown");
      if (pagesOptions.classList.contains("show") && container && !container.contains(e.target)) {
        pagesOptions.classList.remove("show");
        const arr = container.querySelector(".dropdown-arrow");
        arr && arr.classList.remove("rotated");
      }
    });
  }

  // Close Schema Form modal when clicking outside content
  if (schemaFormModal) {
    schemaFormModal.addEventListener("click", (event) => {
      if (event.target === schemaFormModal) {
        handlers.hideSchemaForm();
      }
    });
  }

  // Listen for messages from content script
  window.addEventListener("message", (event) => {
    const message = event.data;

    if (message.action === "scrapingResults") {
      handlers.handleScrapingResults(message.results);
    } else if (message.action === "scrapingError") {
      handlers.handleScrapingError(message.error);
    } else if (message.action === "scrapingProgress") {
      // Progressive multi-page results
      handlers.handleScrapingProgress && handlers.handleScrapingProgress(message.results, message.pageIndex, message.totalPages);
    } else if (message.action === "scrapingDone") {
      handlers.handleScrapingDone && handlers.handleScrapingDone();
    } else if (message.action === "elementSelected") {
      handlers.handleElementSelected(message.selector, message.targetIndex);
    }
  });
}

// Keep reference to handlers for dynamic bindings
let currentHandlers = null;

/**
 * Render the list of schemas
 * @param {Array} schemas - Array of schema objects
 * @param {Object} handlers - Object containing event handler functions
 */
export function renderSchemasList(schemas, handlers, emptyMessage) {
  currentHandlers = handlers;
  // Clear the list
  schemasList.innerHTML = "";

  // Show empty state if no schemas
  if (schemas.length === 0) {
    // Set message depending on overall or filtered-empty state
    const p = emptySchemas.querySelector('p');
    if (p) {
      p.textContent = emptyMessage || "No schemas yet. Create your first schema to start scraping.";
    }
    emptySchemas.classList.remove("hidden");
    return;
  }

  // Hide empty state
  emptySchemas.classList.add("hidden");

  // Create a card for each schema
  schemas.forEach((schema) => {
    const schemaCard = createSchemaCard(schema, handlers);
    schemasList.appendChild(schemaCard);
  });
}

/**
 * Create a schema card element
 * @param {Object} schema - Schema object
 * @param {Object} handlers - Object containing event handler functions
 * @returns {HTMLElement} The created schema card element
 */
function createSchemaCard(schema, handlers) {
  const template = document.getElementById("schema-card-template");
  const card = document.importNode(template.content, true).querySelector(".schema-card");

  // Set schema ID
  card.dataset.schemaId = schema.id;

  // Set schema name and description
  card.querySelector(".schema-name").textContent = schema.name;
  card.querySelector(".schema-description").textContent = schema.description || "No description";

  // Render column name chips
  const chipsContainer = card.querySelector('.columns-chips');
  if (chipsContainer) {
    chipsContainer.innerHTML = '';
    const names = Array.isArray(schema.columns) ? schema.columns.map(c => (c.name || '').trim()).filter(Boolean) : [];
    if (names.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'chip chip-empty';
      empty.textContent = 'No columns';
      chipsContainer.appendChild(empty);
    } else {
      names.forEach((name) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = name;
        chipsContainer.appendChild(chip);
      });
    }
  }

  // Render meta dates
  const createdEl = card.querySelector('.schema-created');
  const updatedEl = card.querySelector('.schema-updated');
  const createdAt = schema.created_at ? new Date(Number(schema.created_at)) : null;
  const updatedAt = schema.updated_at ? new Date(Number(schema.updated_at)) : null;
  const format = (d) => (d && !isNaN(d)) ? d.toLocaleString() : 'N/A';
  if (createdEl) createdEl.textContent = `Created: ${format(createdAt)}`;
  if (updatedEl) updatedEl.textContent = `Updated: ${format(updatedAt)}`;

  // Set up event listeners for card actions
  card.querySelector(".edit-schema").addEventListener("click", () => {
    handlers.editSchema(schema.id);
  });

  card.querySelector(".delete-schema").addEventListener("click", () => {
    handlers.deleteSchema(schema.id);
  });

  card.querySelector(".start-scraping").addEventListener("click", () => {
    handlers.startScraping(schema.id);
  });

  return card;
}

/**
 * Show the schema form
 * @param {Function} addColumnCallback - Function to add a column to the form
 */
export function showSchemaForm(addColumnCallback) {
  // Reset the form
  schemaForm.reset();
  columnsContainer.innerHTML = "";

  // Set form title for new schema
  schemaFormTitle.textContent = "Create Schema";

  // Add initial column
  addColumnCallback();

  // Show the modal with the form
  if (schemaFormModal) schemaFormModal.classList.remove('hidden');
}

/**
 * Hide the schema form
 */
export function hideSchemaForm() {
  if (schemaFormModal) schemaFormModal.classList.add('hidden');
  schemaForm.reset();
  columnsContainer.innerHTML = "";
}

/**
 * Add a column to the form
 * @param {Object} column - Optional column object for editing
 * @returns {HTMLElement} The created column row element
 */
export function addColumnToForm(column = {}) {
  const template = document.getElementById("column-form-template");
  const columnRow = document.importNode(template.content, true).querySelector(".column-form-row");

  // Generate a unique identifier for the column fields using UUID
  // Use existing column ID if provided (for editing), otherwise generate a new UUID
  const columnId = column.id || uuidv4();

  // Store the column ID as a data attribute for future reference
  columnRow.dataset.columnId = columnId;

  // Replace {index} placeholder in template with the UUID
  const elements = columnRow.querySelectorAll('[id*="{index}"], [data-index="{index}"], [for*="{index}"], [name*="{index}"]');

  elements.forEach((element) => {
    // Update id attribute
    if (element.id && element.id.includes("{index}")) {
      const newId = element.id.replace("{index}", columnId);
      element.id = newId;
    }

    // Update for attribute
    if (element.getAttribute("for") && element.getAttribute("for").includes("{index}")) {
      const newFor = element.getAttribute("for").replace("{index}", columnId);
      element.setAttribute("for", newFor);
    }

    // Update name attribute
    if (element.getAttribute("name") && element.getAttribute("name").includes("{index}")) {
      const newName = element.getAttribute("name").replace("{index}", columnId);
      element.setAttribute("name", newName);
    }

    // Update data-index attribute
    if (element.hasAttribute("data-index")) {
      const oldValue = element.getAttribute("data-index");
      if (oldValue.includes("{index}")) {
        element.setAttribute("data-index", columnId);
      }
    }
  });

  // Double-check the selector picker button - this is critical for proper element selection
  const pickerButton = columnRow.querySelector(".selector-picker-button");
  if (pickerButton) {
    if (pickerButton.getAttribute("data-index") !== columnId) {
      pickerButton.setAttribute("data-index", columnId);
    }
  } else {
    console.error("Selector picker button not found in the column row");
  }

  // Set placeholders for inputs
  columnRow.querySelector(".column-name").placeholder = "e.g. Product Name";
  columnRow.querySelector(".column-selector").placeholder = "e.g. .product-title";
  columnRow.querySelector(".column-attribute").placeholder = "e.g. data-product-id";
  columnRow.querySelector(".column-regexp-pattern").placeholder = "e.g. \\d+(.\\d+)?";

  // Set values if editing an existing column
  if (column.name) {
    columnRow.querySelector(".column-name").value = column.name;
    columnRow.querySelector(".column-selector").value = column.selector;
    columnRow.querySelector(".column-type").value = column.type || "text";

    if (column.type === "attribute" && column.attribute_name) {
      columnRow.querySelector(".attribute-name-group").classList.remove("hidden");
      columnRow.querySelector(".column-attribute").value = column.attribute_name;
    }

    if (column.type === "style" && column.style_property) {
      columnRow.querySelector(".style-property-group").classList.remove("hidden");
      columnRow.querySelector(".column-style-property").value = column.style_property;
    }

    if (column.use_regexp) {
      columnRow.querySelector(".column-use-regexp").checked = true;
      columnRow.querySelector(".regexp-pattern-group").classList.remove("hidden");
      if (column.regexp_pattern) {
        columnRow.querySelector(".column-regexp-pattern").value = column.regexp_pattern;
      }
    }

    if (column.multiple_elements) {
      columnRow.querySelector(".column-multiple").checked = true;
    }
  }

  // Add event listener for column type change
  const typeSelect = columnRow.querySelector(".column-type");
  typeSelect.addEventListener("change", () => {
    const attributeGroup = columnRow.querySelector(".attribute-name-group");
    const stylePropertyGroup = columnRow.querySelector(".style-property-group");

    // Hide all additional input groups first
    attributeGroup.classList.add("hidden");
    stylePropertyGroup.classList.add("hidden");

    // Show the appropriate input group based on the selected type
    if (typeSelect.value === "attribute") {
      attributeGroup.classList.remove("hidden");
    } else if (typeSelect.value === "style") {
      stylePropertyGroup.classList.remove("hidden");
    }

    // Check if RegExp checkbox is checked and show/hide pattern field accordingly
    const useRegexpCheckbox = columnRow.querySelector(".column-use-regexp");
    if (useRegexpCheckbox.checked) {
      columnRow.querySelector(".regexp-pattern-group").classList.remove("hidden");
    } else {
      columnRow.querySelector(".regexp-pattern-group").classList.add("hidden");
    }
  });

  // Add event listener for RegExp checkbox
  const useRegexpCheckbox = columnRow.querySelector(".column-use-regexp");
  useRegexpCheckbox.addEventListener("change", () => {
    const regexpPatternGroup = columnRow.querySelector(".regexp-pattern-group");
    if (useRegexpCheckbox.checked) {
      regexpPatternGroup.classList.remove("hidden");
    } else {
      regexpPatternGroup.classList.add("hidden");
    }
  });

  // Add event listener for delete column button
  columnRow.querySelector(".delete-column").addEventListener("click", () => {
    // Only allow deletion if there's more than one column
    if (columnsContainer.children.length > 1) {
      columnRow.remove();
    } else {
      alert("You must have at least one column in a schema.");
    }
  });

  // Add event listeners for column reordering
  columnRow.querySelector(".move-column-up").addEventListener("click", () => {
    const prevSibling = columnRow.previousElementSibling;
    if (prevSibling) {
      columnsContainer.insertBefore(columnRow, prevSibling);
    }
  });

  columnRow.querySelector(".move-column-down").addEventListener("click", () => {
    const nextSibling = columnRow.nextElementSibling;
    if (nextSibling) {
      columnsContainer.insertBefore(nextSibling, columnRow);
    }
  });

  // Add the column row to the container
  columnsContainer.appendChild(columnRow);

  return columnRow;
}

/**
 * Handle selected element from content script
 * @param {string} selector - CSS selector for the selected element
 * @param {string} targetIndex - Target index (UUID) for the selector
 */
export function handleElementSelected(selector, targetIndex) {
  // Find the button that corresponds to the target index (now a UUID)
  const button = document.querySelector(`.selector-picker-button[data-index="${targetIndex}"]`);

  if (!button) {
    console.error(`Could not find selector picker button for index: ${targetIndex}`);
    return;
  }

  // Check if this is the card selector button
  if (targetIndex === "card-selector") {
    const cardSelectorInput = document.getElementById("card-selector");
    if (cardSelectorInput) {
      cardSelectorInput.value = selector;
      // Add a brief highlight effect to show the input has been updated
      cardSelectorInput.classList.add("selector-updated");
      setTimeout(() => {
        cardSelectorInput.classList.remove("selector-updated");
      }, 1000);
    }
    return;
  }

  // Next button selector
  if (targetIndex === "next-button-selector") {
    const nextButtonInput = document.getElementById("next-button-selector");
    if (nextButtonInput) {
      nextButtonInput.value = selector;
      nextButtonInput.classList.add("selector-updated");
      setTimeout(() => {
        nextButtonInput.classList.remove("selector-updated");
      }, 1000);
    }
    return;
  }

  // Get the closest column form row and find the selector input within it
  const columnRow = button.closest(".column-form-row");

  if (columnRow) {
    const selectorInput = columnRow.querySelector("input.column-selector");

    if (selectorInput) {
      selectorInput.value = selector;
      // Add a brief highlight effect to show the input has been updated
      selectorInput.classList.add("selector-updated");
      setTimeout(() => {
        selectorInput.classList.remove("selector-updated");
      }, 1000);
    } else {
      console.error(`Could not find selector input for column ID: ${targetIndex}`);
    }
  }
  if (targetIndex === "parent-selector") {
    const parentSelectorInput = document.getElementById("parent-selector");
    if (parentSelectorInput) {
      parentSelectorInput.value = selector;
      parentSelectorInput.classList.add("selector-updated");
      setTimeout(() => {
        parentSelectorInput.classList.remove("selector-updated");
      }, 1000);
    }
    return;
  }
}

/**
 * Show results view
 */
export function showResultsView() {
  schemaFormContainer.classList.add("hidden");
  resultsContainer.classList.remove("hidden");
}

/**
 * Hide results view
 */
export function hideResultsView() {
  resultsContainer.classList.add("hidden");
}

/**
 * Extracts all columns from the schema form
 * @returns {Array} Array of column objects
 */
export function getColumnsFromForm() {
  const columns = [];
  const columnsContainer = document.getElementById("columns-container");
  const columnRows = columnsContainer.querySelectorAll(".column-form-row");
  columnRows.forEach((row) => {
    const columnId = row.dataset.columnId || "";
    const name = row.querySelector(".column-name")?.value.trim() || "";
    const selector = row.querySelector(".column-selector")?.value.trim() || "";
    const type = row.querySelector(".column-type")?.value || "text";
    const attribute_name = row.querySelector(".column-attribute")?.value.trim() || "";
    const style_property = row.querySelector(".column-style-property")?.value.trim() || "";
    const use_regexp = row.querySelector(".column-use-regexp")?.checked || false;
    const regexp_pattern = row.querySelector(".column-regexp-pattern")?.value.trim() || "";
    const multiple_elements = row.querySelector(".column-multiple")?.checked || false;
    columns.push({
      id: columnId,
      name,
      selector,
      type,
      attribute_name,
      style_property,
      use_regexp,
      regexp_pattern,
      multiple_elements,
    });
  });
  return columns;
}

/**
 * Get form data from schema form
 * @returns {Object} Object containing form data
 */
export function getSchemaFormData() {
  const formData = {
    name: document.getElementById("schema-name").value.trim(),
    description: document.getElementById("schema-description").value.trim(),
    parentSelector: document.getElementById("parent-selector").value.trim(),
    cardSelector: document.getElementById("card-selector").value.trim(),
    nextButtonSelector: document.getElementById("next-button-selector")?.value.trim() || "",
    nextDelayMs: parseInt(document.getElementById("next-delay-ms")?.value, 10) || 0,
    maxPages: parseInt(document.getElementById("max-pages")?.value, 10) || 1,
    columns: getColumnsFromForm(),
  };

  return formData;
}
