// Schema management for Simple Web Scraper extension
import { uuidv4 } from './utils.js';
import { loadSchemas, saveSchemas } from './storage.js';
import * as ui from './ui.js';
import * as results from './results.js';

// Constants
const SCHEMA_FILE_NAME = 'simple-scraper-schemas.json';
// State variables
let schemas = [];
let currentSchemaId = null;
let editMode = false;
let schemaFilter = '';
let sortField = 'created_at';
let sortDir = 'desc'; // 'asc' | 'desc'

/**
 * Initialize schema manager
 * @param {Function} callback - Function to call after initialization
 */
export function init(callback) {
  loadSchemas((loadedSchemas) => {
    schemas = loadedSchemas;
    if (callback && typeof callback === 'function') {
      callback();
    }
  });
}

/**
 * Get all schemas
 * @returns {Array}
 */
export function getSchemas() {
  return schemas;
}

/**
 * Get a schema by ID
 * @param {string} schemaId
 * @returns {Object|null}
 */
export function getSchemaById(schemaId) {
  return schemas.find((s) => s.id === schemaId) || null;
}

/**
 * Render the schemas list
 */
export function renderSchemas() {
  const handlers = {
    editSchema,
    deleteSchema,
    startScraping,
    stopScraping,
  };
  const filtered = applyFilter(schemas, schemaFilter);
  const sorted = applySort(filtered, sortField, sortDir);
  const emptyMessage = schemas.length > 0 && filtered.length === 0 ? 'No matching schemas' : undefined;
  ui.renderSchemasList(sorted, handlers, emptyMessage);
}

/**
 * Set schema search filter and re-render
 */
export function setSchemaFilter(term) {
  schemaFilter = (term || '').trim().toLowerCase();
  renderSchemas();
}

/**
 * Set schema sort option and re-render
 * @param {string} option e.g. "name:asc" | "created_at:desc"
 */
export function setSchemaSort(option) {
  if (!option || typeof option !== 'string') return;
  const [field, dir] = option.split(':');
  if (field) sortField = field;
  if (dir === 'asc' || dir === 'desc') sortDir = dir;
  renderSchemas();
}

/**
 * Apply filter by name/description
 */
function applyFilter(list, term) {
  if (!term) return list;
  return list.filter((s) => {
    const name = (s.name || '').toLowerCase();
    const desc = (s.description || '').toLowerCase();
    return name.includes(term) || desc.includes(term);
  });
}

/**
 * Apply sort by field and direction
 */
function applySort(list, field, dir) {
  const factor = dir === 'desc' ? -1 : 1;
  const arr = [...list];
  arr.sort((a, b) => compareSchemas(a, b, field) * factor);
  return arr;
}

function compareSchemas(a, b, field) {
  switch (field) {
    case 'created_at':
    case 'updated_at': {
      const av = Number(a[field] || 0);
      const bv = Number(b[field] || 0);
      return av === bv ? 0 : av < bv ? -1 : 1;
    }
    case 'name':
    default: {
      const av = (a.name || '').toString().toLowerCase();
      const bv = (b.name || '').toString().toLowerCase();
      if (av === bv) return 0;
      return av < bv ? -1 : 1;
    }
  }
}

/**
 * Show the schema form for creating a new schema
 */
export function showSchemaForm() {
  // Reset edit mode and current schema ID
  editMode = false;
  currentSchemaId = null;

  ui.showSchemaForm(addColumnToForm);
  // Ensure inner form container is visible in case it was hidden by results view
  const formContainer = document.getElementById('schema-form-container');
  if (formContainer) formContainer.classList.remove('hidden');
}

/**
 * Hide the schema form
 */
export function hideSchemaForm() {
  editMode = false;
  currentSchemaId = null;
  ui.hideSchemaForm();
}

/**
 * Add a column to the form
 */
export function addColumnToForm(column = {}) {
  ui.addColumnToForm(column);
}

/**
 * Save the schema form
 */
export function saveSchemaForm() {
  const formData = ui.getSchemaFormData();

  if (editMode && currentSchemaId) {
    // Update existing schema
    const schemaIndex = schemas.findIndex((s) => s.id === currentSchemaId);
    if (schemaIndex !== -1) {
      schemas[schemaIndex] = {
        ...schemas[schemaIndex],
        name: formData.name,
        description: formData.description,
        parentSelector: formData.parentSelector,
        cardSelector: formData.cardSelector,
        nextButtonSelector: formData.nextButtonSelector,
        nextDelayMs: formData.nextDelayMs,
        maxPages: formData.maxPages,
        columns: formData.columns,
        updated_at: Date.now(),
      };
    }
  } else {
    // Create new schema
    const newSchema = {
      id: uuidv4(),
      name: formData.name,
      description: formData.description,
      parentSelector: formData.parentSelector,
      cardSelector: formData.cardSelector,
      nextButtonSelector: formData.nextButtonSelector,
      nextDelayMs: formData.nextDelayMs,
      maxPages: formData.maxPages,
      columns: formData.columns,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    schemas.push(newSchema);
  }

  saveSchemas(schemas);
  hideSchemaForm();
  renderSchemas();
}

/**
 * Edit a schema
 * @param {string} schemaId - ID of the schema to edit
 */
export function editSchema(schemaId) {
  const schema = getSchemaById(schemaId);
  if (!schema) return;

  // Set form title for edit mode
  document.getElementById('schema-form-title').textContent = 'Edit Schema';

  // Set form values
  document.getElementById('schema-name').value = schema.name;
  document.getElementById('schema-description').value = schema.description || '';
  document.getElementById('parent-selector').value = schema.parentSelector || '';
  document.getElementById('card-selector').value = schema.cardSelector || '';
  document.getElementById('next-button-selector').value = schema.nextButtonSelector || '';
  document.getElementById('next-delay-ms').value = schema.nextDelayMs != null ? schema.nextDelayMs : '';
  document.getElementById('max-pages').value = schema.maxPages != null ? schema.maxPages : '';

  // Clear columns container
  document.getElementById('columns-container').innerHTML = '';

  // Add columns to form
  schema.columns.forEach((column) => {
    addColumnToForm(column);
  });

  // Set edit mode and current schema ID
  editMode = true;
  currentSchemaId = schemaId;

  // Show the form modal
  const modal = document.getElementById('schema-form-modal');
  if (modal) modal.classList.remove('hidden');
  // Ensure inner form container is visible in case it was hidden by results view
  const formContainer = document.getElementById('schema-form-container');
  if (formContainer) formContainer.classList.remove('hidden');
}
export function deleteSchema(schemaId) {
  if (confirm('Are you sure you want to delete this schema?')) {
    schemas = schemas.filter(s => s.id !== schemaId);
    saveSchemas(schemas);
    renderSchemas();
  }
}

/**
 * Start scraping with a schema
 * @param {string} schemaId - ID of the schema to use for scraping
 */
export function startScraping(schemaId) {
  const schema = getSchemaById(schemaId);
  if (!schema) return;
  
  // Send message to content script to start scraping
  window.parent.postMessage({
    action: 'startScraping',
    schema: schema
  }, '*');

  // Update UI state to reflect running
  ui.setScrapingUIState(schemaId, true);

  // Proactively open the results view so the user sees the modal immediately
  if (typeof results.showResultsView === 'function') {
    results.showResultsView();
  }
}

/**
 * Stop scraping
 * @param {string} schemaId
 */
export function stopScraping(schemaId) {
  window.parent.postMessage({ action: 'stopScraping' }, '*');
  ui.setScrapingUIState(schemaId, false);
}

/**
 * Called when the content script notifies scraping is done
 * Resets all schema card buttons to their default state
 */
export function handleScrapingDone() {
  ui.resetScrapingUIState();
}

/**
 * Export all schemas to a JSON file
 */
export function exportSchemas() {
  if (schemas.length === 0) {
    alert('No schemas to export.');
    return;
  }
  
  // Convert schemas to JSON string with pretty formatting
  const jsonData = JSON.stringify(schemas, null, 2);
  
  // Create download link
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = SCHEMA_FILE_NAME;
  a.click();
  
  // Clean up
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Show import options dialog
 * @param {File} file - The JSON file containing schemas to import
 */
export function importSchemas(file) {
  // Store the file for later use
  const importOptionsDialog = document.getElementById('import-options-dialog');
  importOptionsDialog.dataset.file = file.name; // Store file name for reference
  
  // Show the dialog
  importOptionsDialog.classList.remove('hidden');
  
  // Set up event listeners for the dialog buttons
  document.getElementById('import-cancel').onclick = () => {
    importOptionsDialog.classList.add('hidden');
  };
  
  document.getElementById('import-confirm').onclick = () => {
    // Get selected option
    const selectedOption = document.querySelector('input[name="import-option"]:checked').value;
    
    // Hide the dialog
    importOptionsDialog.classList.add('hidden');
    
    // Process the import with the selected option
    processImport(file, selectedOption);
  };
}

/**
 * Process schema import with the selected duplicate handling option
 * @param {File} file - The JSON file containing schemas to import
 * @param {string} duplicateOption - How to handle duplicates: 'skip', 'replace', or 'keep-both'
 */
function processImport(file, duplicateOption) {
  const reader = new FileReader();
  
  reader.onload = (event) => {
    try {
      // Parse the JSON data
      const importedSchemas = JSON.parse(event.target.result);
      
      // Validate the imported data
      if (!Array.isArray(importedSchemas)) {
        throw new Error('Invalid schema format: Expected an array of schemas');
      }
      
      // Track import statistics
      let added = 0;
      let replaced = 0;
      let skipped = 0;
      let invalid = 0;
      
      // Process each imported schema
      importedSchemas.forEach(schema => {
        // Validate schema structure
        if (!isValidSchema(schema)) {
          invalid++;
          return;
        }
        
        // Check if schema with same ID already exists
        const existingIndex = schemas.findIndex(s => s.id === schema.id);
        
        if (existingIndex === -1) {
          // No duplicate, add new schema
          schemas.push(schema);
          added++;
        } else {
          // Handle duplicate based on selected option
          switch (duplicateOption) {
            case 'skip':
              // Skip the imported schema (keep existing)
              skipped++;
              break;
              
            case 'replace':
              // Replace existing schema with imported one
              schemas[existingIndex] = schema;
              replaced++;
              break;
              
            case 'keep-both':
              // Keep both by assigning a new ID to the imported schema
              const newSchema = {
                ...schema,
                id: uuidv4(), // Generate a new unique ID
                name: `${schema.name} (Copy)` // Append '(Copy)' to name for clarity
              };
              schemas.push(newSchema);
              added++;
              break;
          }
        }
      });
      
      // Save updated schemas to storage
      saveSchemas(schemas);
      
      // Refresh the UI
      renderSchemas();
      
      // Show import results
      let resultMessage = `Import complete:\n${added} schemas added`;
      if (replaced > 0) resultMessage += `\n${replaced} schemas replaced`;
      if (skipped > 0) resultMessage += `\n${skipped} schemas skipped`;
      if (invalid > 0) resultMessage += `\n${invalid} invalid schemas`;
      
      alert(resultMessage);
      
    } catch (error) {
      console.error('Error importing schemas:', error);
      alert(`Error importing schemas: ${error.message}`);
    }
  };
  
  reader.onerror = () => {
    alert('Error reading the file');
  };
  
  reader.readAsText(file);
}

/**
 * Validate schema structure
 * @param {Object} schema - Schema object to validate
 * @returns {boolean} True if schema is valid, false otherwise
 */
function isValidSchema(schema) {
  // Check required fields
  if (!schema.id || typeof schema.id !== 'string') return false;
  if (!schema.name || typeof schema.name !== 'string') return false;
  if (!Array.isArray(schema.columns)) return false;
  
  // Check columns
  for (const column of schema.columns) {
    if (!column.id || typeof column.id !== 'string') return false;
    if (!column.name || typeof column.name !== 'string') return false;
    if (!column.selector || typeof column.selector !== 'string') return false;
    if (!column.type || typeof column.type !== 'string') return false;
  }
  
  return true;
}

/**
 * Activate element selector mode
 * @param {string} index - Index (UUID) for the selector
 */
export function activateElementSelector(index) {
  // Send message to content script to activate element selector mode
  window.parent.postMessage({
    action: 'activateElementSelector',
    targetIndex: index
  }, '*');
}

/**
 * Handle selected element from content script
 * @param {string} selector - CSS selector for the selected element
 * @param {string} targetIndex - Target index (UUID) for the selector
 */
export function handleElementSelected(selector, targetIndex) {
  ui.handleElementSelected(selector, targetIndex);
}