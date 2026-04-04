// Results handling for Simple Web Scraper extension
import { uuidv4 } from "./utils.js";
import * as ui from "./ui.js";

// State variables
let pages = []; // [{ index: 1, items: [...], diagnostics: [...] }]
let totalPagesPlanned = 1;
let resultsModalListenersAttached = false;

/**
 * Set scraping results
 * @param {Array} results - Array of scraping result objects
 */
export function setResults(results) {
  pages = [{ index: 1, items: results, diagnostics: [] }];
  totalPagesPlanned = 1;
  // Initialize pages filter UI for single-page results
  renderPagesSelect();
  attachFiltersHandlers();
}

/**
 * Set scraping results with diagnostics (single page)
 * @param {Array} results
 * @param {Array} diagnostics
 */
export function setResultsWithDiagnostics(results, diagnostics) {
  pages = [{ index: 1, items: results, diagnostics: Array.isArray(diagnostics) ? diagnostics : [] }];
  totalPagesPlanned = 1;
  renderPagesSelect();
  attachFiltersHandlers();
}

/**
 * Get scraping results
 * @returns {Array} Array of scraping result objects
 */
export function getResults() {
  // Flatten all pages
  return pages.flatMap((p) => p.items);
}

/**
 * Show results view
 */
export function showResultsView() {
  // Prefer the modal if present; fallback to previous inline view
  const modal = document.getElementById("results-modal");
  if (modal) {
    modal.classList.remove("hidden");
    attachResultsModalOutsideClick();
  } else {
    ui.showResultsView();
  }
}

// Initialize pages dropdown (so it can open even before any results)
export function initPagesDropdown() {
  try {
    renderPagesSelect();
    attachFiltersHandlers();
  } catch (_) {}
}

/**
 * Hide results view
 */
export function hideResultsView() {
  const modal = document.getElementById("results-modal");
  if (modal) {
    modal.classList.add("hidden");
  } else {
    ui.hideResultsView();
  }
  pages = [];
  totalPagesPlanned = 1;
}

function attachResultsModalOutsideClick() {
  if (resultsModalListenersAttached) return;
  const modal = document.getElementById("results-modal");
  if (!modal) return;
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      hideResultsView();
    }
  });
  resultsModalListenersAttached = true;
}

/**
 * Render results table
 */
export function renderResultsTable() {
  // Get the results table container
  const resultsTableContainer = document.getElementById("results-table-container");
  const selectedPageIndices = getSelectedPageIndices();

  // Clear the container
  resultsTableContainer.innerHTML = "";

  // Render diagnostics above the table
  renderDiagnostics();

  // If no results, show message
  const allItems = pages.flatMap((p) => p.items);
  if (allItems.length === 0) {
    resultsTableContainer.innerHTML = '<div class="empty-state">No results found.</div>';
    return;
  }

  // Prepare selected pages filter
  const itemsToShow = (selectedPageIndices.length > 0 ? pages.filter((p) => selectedPageIndices.includes(p.index)) : pages).flatMap((p) => p.items);

  // Create table
  const table = document.createElement("table");

  // Create table header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  // Add numbering column header
  const numberingHeader = document.createElement("th");
  numberingHeader.textContent = "#";
  headerRow.appendChild(numberingHeader);

  // Get column names from first result
  const columns = Object.keys(itemsToShow[0]);

  // Add header cells
  columns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Create table body
  const tbody = document.createElement("tbody");

  // Add rows for each result
  itemsToShow.forEach((result, index) => {
    const row = document.createElement("tr");

    // Add row number cell
    const numberCell = document.createElement("td");
    numberCell.textContent = index + 1;
    row.appendChild(numberCell);

    columns.forEach((column) => {
      const td = document.createElement("td");
      const val = result[column];
      if (Array.isArray(val)) {
        td.style.whiteSpace = "pre-wrap";
        td.textContent = val.map(v => `- ${v}`).join("\n");
      } else {
        td.textContent = val || "";
      }
      row.appendChild(td);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  resultsTableContainer.appendChild(table);
}

/**
 * Reset and render pages select options based on known pages
 */
function renderPagesSelect() {
  const container = document.getElementById("pages-options");
  if (!container) return;
  // Remove existing page options (keep the Select All button)
  Array.from(container.querySelectorAll(".page-option")).forEach((el) => el.remove());
  // If no pages yet, show a disabled placeholder option so the dropdown isn't empty
  if (pages.length === 0) {
    const placeholder = document.createElement("button");
    placeholder.type = "button";
    placeholder.className = "export-option page-option";
    placeholder.disabled = true;
    placeholder.textContent = "No pages yet";
    container.appendChild(placeholder);
    // Update the Select All button label appropriately when there are no pages
    updateSelectAllButtonLabel();
    return;
  }
  // Insert page checkbox options
  pages.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "export-option page-option";
    // Build label with checkbox
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "8px";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "page-checkbox";
    input.dataset.index = String(p.index);
    input.checked = true;
    const text = document.createElement("span");
    text.textContent = `Page ${p.index}`;
    label.appendChild(input);
    label.appendChild(text);
    btn.appendChild(label);
    container.appendChild(btn);
  });
  // Ensure the Select All/Deselect All button label reflects current state
  updateSelectAllButtonLabel();
}

/**
 * Handle progressive page results
 */
export function addPageResults(items, pageIndex, totalPages, diagnostics = []) {
  totalPagesPlanned = totalPages || totalPagesPlanned;
  // Replace or add page
  const existingIdx = pages.findIndex((p) => p.index === pageIndex);
  if (existingIdx >= 0) pages[existingIdx] = { index: pageIndex, items, diagnostics };
  else pages.push({ index: pageIndex, items, diagnostics });
  // Sort by index
  pages.sort((a, b) => a.index - b.index);
  // Ensure filters UI shows pages
  renderPagesSelect();
  // Render table based on current selection
  renderResultsTable();
}

export function attachFiltersHandlers() {
  const selectAllBtn = document.getElementById("select-all-pages");
  const pagesOptions = document.getElementById("pages-options");
  // Checkbox change re-renders
  if (pagesOptions) {
    pagesOptions.addEventListener("change", (e) => {
      if (e.target && e.target.classList.contains("page-checkbox")) {
        renderResultsTable();
        updateSelectAllButtonLabel();
      }
    });
  }
  // Select all
  if (selectAllBtn) {
    selectAllBtn.addEventListener("click", () => {
      const allChecked = areAllPagesChecked();
      // Toggle: if all are checked, deselect all; otherwise select all
      Array.from(document.querySelectorAll("#pages-options .page-checkbox")).forEach((cb) => (cb.checked = !allChecked));
      renderResultsTable();
      updateSelectAllButtonLabel();
    });
  }
}

/**
 * Export results as CSV
 */
export function exportResults() {
  const selectedPageIndices = getSelectedPageIndices();
  const items = (selectedPageIndices.length > 0 ? pages.filter((p) => selectedPageIndices.includes(p.index)) : pages).flatMap((p) => p.items);

  if (items.length === 0) {
    alert("No results to export.");
    return;
  }

  // Get column names from first result
  const columns = Object.keys(items[0]);

  // Create CSV header row
  let csv = columns.join(",") + "\n";

  // Add data rows
  items.forEach((result) => {
    const row = columns.map((column) => {
      // Escape quotes and wrap in quotes if contains comma
      let value = result[column];
      if (Array.isArray(value)) {
        value = value.map(v => `- ${v}`).join("\n");
      } else {
        value = value || "";
      }
      const escaped = String(value).replace(/"/g, '""');
      return escaped.includes(",") || escaped.includes("\n") ? `"${escaped}"` : escaped;
    });
    csv += row.join(",") + "\n";
  });

  // Create download link
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scraping-results-${uuidv4()}.csv`;
  a.click();

  // Clean up
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}

// Helpers
function getSelectedPageIndices() {
  const cbs = Array.from(document.querySelectorAll("#pages-options .page-checkbox"));
  const checked = cbs.filter((cb) => cb.checked).map((cb) => parseInt(cb.dataset.index, 10));
  // If none selected, treat as all selected (show everything)
  return checked.length > 0 ? checked : [];
}

// Determine if all page checkboxes are currently checked
function areAllPagesChecked() {
  const cbs = Array.from(document.querySelectorAll("#pages-options .page-checkbox"));
  return cbs.length > 0 && cbs.every((cb) => cb.checked);
}

// Update the Select All button label based on checkbox state
function updateSelectAllButtonLabel() {
  const btn = document.getElementById("select-all-pages");
  if (!btn) return;
  const anyCheckboxes = document.querySelector("#pages-options .page-checkbox") !== null;
  if (!anyCheckboxes) {
    btn.textContent = "Select All";
    return;
  }
  btn.textContent = areAllPagesChecked() ? "Deselect All" : "Select All";
}

/**
 * Render diagnostics panel above the table
 */
function renderDiagnostics() {
  const container = document.getElementById("results-diagnostics-container");
  if (!container) return;

  // Reset
  container.innerHTML = "";

  // Title
  const title = document.createElement("h3");
  title.textContent = "Scraping Diagnostics";
  container.appendChild(title);

  const selectedPageIndices = getSelectedPageIndices();
  const relevantPages = (selectedPageIndices.length > 0 ? pages.filter((p) => selectedPageIndices.includes(p.index)) : pages);

  if (!relevantPages || relevantPages.length === 0) return;

  if (relevantPages.length > 1) {
    relevantPages.forEach((p) => {
      const groupTitle = document.createElement("div");
      groupTitle.className = "diagnostics-page-title";
      groupTitle.textContent = `Page ${p.index}`;
      container.appendChild(groupTitle);

      appendDiagnosticsList(container, p.diagnostics);
    });
  } else {
    appendDiagnosticsList(container, relevantPages[0].diagnostics);
  }
}

function appendDiagnosticsList(container, diagnostics) {
  const list = document.createElement("ul");
  list.id = "results-diagnostics-list";
  list.className = "results-diagnostics-list";

  const items = Array.isArray(diagnostics) ? diagnostics : [];
  if (items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No diagnostics available.";
    list.appendChild(li);
  } else {
    items.forEach((msg) => {
      const li = document.createElement("li");
      li.textContent = msg;
      list.appendChild(li);
    });
  }

  container.appendChild(list);
}

/**
 * Export results as JSON
 */
export function exportAsJson() {
  const selectedPageIndices = getSelectedPageIndices();
  const items = (selectedPageIndices.length > 0 ? pages.filter((p) => selectedPageIndices.includes(p.index)) : pages).flatMap((p) => p.items);

  if (items.length === 0) {
    alert("No results to export.");
    return;
  }

  // Convert results to JSON string with pretty formatting
  const jsonData = JSON.stringify(items, null, 2);

  // Create download link
  const blob = new Blob([jsonData], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scraping-results-${uuidv4()}.json`;
  a.click();

  // Clean up
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}
