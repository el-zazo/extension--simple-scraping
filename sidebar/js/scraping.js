// Scraping operations for Simple Web Scraper extension
import * as resultsManager from './results.js';
import * as schemaManager from './schema-manager.js';

/**
 * Handle scraping results from content script
 * @param {Array} results - Array of scraping result objects
 */
export function handleScrapingResults(results) {
  resultsManager.setResults(results);
  resultsManager.showResultsView();
  resultsManager.renderResultsTable();
}

/**
 * Handle scraping error from content script
 * @param {string} error - Error message
 */
export function handleScrapingError(error) {
  alert(`Scraping Error: ${error}`);
}

/**
 * Handle progressive page results
 */
export function handleScrapingProgress(results, pageIndex, totalPages) {
  resultsManager.showResultsView();
  resultsManager.addPageResults(results, pageIndex, totalPages);
  resultsManager.attachFiltersHandlers();
}

/**
 * Handle scraping finished event
 */
export function handleScrapingDone() {
  // Reset UI start/stop buttons
  if (typeof schemaManager.handleScrapingDone === 'function') {
    schemaManager.handleScrapingDone();
  }
}