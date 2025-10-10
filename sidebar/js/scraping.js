// Scraping operations for Simple Web Scraper extension
import * as resultsManager from './results.js';
import * as schemaManager from './schema-manager.js';

/**
 * Handle scraping results from content script
 * @param {Array} results - Array of scraping result objects
 * @param {Array} diagnostics - Array of diagnostic objects
 */
export function handleScrapingResults(results, diagnostics) {
  if (typeof resultsManager.setResultsWithDiagnostics === 'function') {
    resultsManager.setResultsWithDiagnostics(results, diagnostics || []);
  } else {
    resultsManager.setResults(results);
  }
  resultsManager.showResultsView();
  resultsManager.renderResultsTable();
}

/**
 * Handle progressive scraping results (multi-page)
 * @param {Array} results
 * @param {number} pageIndex
 * @param {number} totalPages
 * @param {Array} diagnostics
 */
export function handleScrapingProgress(results, pageIndex, totalPages, diagnostics) {
  resultsManager.showResultsView();
  resultsManager.addPageResults(results, pageIndex, totalPages, diagnostics || []);
  resultsManager.attachFiltersHandlers();
}

/**
 * Handle scraping done (reset UI state)
 */
export function handleScrapingDone() {
  if (typeof schemaManager.handleScrapingDone === 'function') {
    schemaManager.handleScrapingDone();
  }
}

/**
 * Handle scraping error
 * @param {string} error
 */
export function handleScrapingError(error) {
  console.error('Scraping error:', error);
  if (typeof schemaManager.handleScrapingDone === 'function') {
    schemaManager.handleScrapingDone();
  }
}