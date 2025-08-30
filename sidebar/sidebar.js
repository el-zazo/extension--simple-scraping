// Sidebar JavaScript for Simple Web Scraper extension
// This file is maintained for backward compatibility
// It re-exports all functionality from the modular files

// Import all modules
import * as utils from './js/utils.js';
import * as storage from './js/storage.js';
import * as ui from './js/ui.js';
import * as schemaManager from './js/schema-manager.js';
import * as scraping from './js/scraping.js';
import * as results from './js/results.js';

// Re-export all functionality
export {
  utils,
  storage,
  ui,
  schemaManager,
  scraping,
  results
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  // Redirect to the main module
  import('./js/main.js');
});