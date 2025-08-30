// Main application file for Simple Web Scraper extension
import * as schemaManager from './schema-manager.js';
import * as scraping from './scraping.js';
import * as results from './results.js';
import * as ui from './ui.js';

// Initialize the sidebar
document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme
  ui.initTheme();
  
  // Initialize schema manager
  schemaManager.init(() => {
    // Render schemas list
    schemaManager.renderSchemas();
    
    // Set up event listeners
    setupEventListeners();

    // Initialize pages dropdown so it toggles and shows placeholder before results
    if (typeof results.initPagesDropdown === 'function') {
      results.initPagesDropdown();
    }
  });
});

// Set up event listeners
function setupEventListeners() {
  // Create event handlers object
  const handlers = {
    // Schema form handlers
    showSchemaForm: schemaManager.showSchemaForm,
    hideSchemaForm: schemaManager.hideSchemaForm,
    addColumnToForm: schemaManager.addColumnToForm,
    saveSchemaForm: schemaManager.saveSchemaForm,
    setSchemaFilter: schemaManager.setSchemaFilter,
    setSchemaSort: schemaManager.setSchemaSort,
    
    // Schema operations
    editSchema: schemaManager.editSchema,
    deleteSchema: schemaManager.deleteSchema,
    startScraping: schemaManager.startScraping,
    stopScraping: schemaManager.stopScraping,
    exportSchemas: schemaManager.exportSchemas,
    importSchemas: schemaManager.importSchemas,
    
    // Element selector
    activateElementSelector: schemaManager.activateElementSelector,
    handleElementSelected: schemaManager.handleElementSelected,
    
    // Results handlers
    handleScrapingResults: scraping.handleScrapingResults,
    handleScrapingError: scraping.handleScrapingError,
    handleScrapingProgress: scraping.handleScrapingProgress,
    handleScrapingDone: scraping.handleScrapingDone,
    hideResultsView: results.hideResultsView,
    exportResults: results.exportResults,
    exportAsJson: results.exportAsJson
  };
  
  // Set up UI event listeners with handlers
  ui.setupEventListeners(handlers);
  
  // Set up schema import/export event listeners
  setupSchemaImportExport(handlers);
}

// Set up schema import/export event listeners
function setupSchemaImportExport(handlers) {
  // Export schemas button
  document.getElementById('export-schemas').addEventListener('click', handlers.exportSchemas);
  
  // Import schemas button
  document.getElementById('import-schemas').addEventListener('click', () => {
    // Trigger file input click
    document.getElementById('schema-import-input').click();
  });
  
  // File input change event
  document.getElementById('schema-import-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      handlers.importSchemas(file);
      // Reset file input
      event.target.value = '';
    }
  });
  
  // Import dialog cancel button (additional safety in case the event listeners in schema-manager.js don't work)
  const importCancelButton = document.getElementById('import-cancel');
  if (importCancelButton) {
    importCancelButton.addEventListener('click', () => {
      document.getElementById('import-options-dialog').classList.add('hidden');
    });
  }
  
  // Close modal when clicking outside of it
  const importOptionsDialog = document.getElementById('import-options-dialog');
  if (importOptionsDialog) {
    importOptionsDialog.addEventListener('click', (event) => {
      if (event.target === importOptionsDialog) {
        importOptionsDialog.classList.add('hidden');
      }
    });
  }
}