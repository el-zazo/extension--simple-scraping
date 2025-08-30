// Utility functions for Simple Web Scraper extension

/**
 * Generates a UUID (RFC4122 version 4 compliant)
 * @returns {string} A randomly generated UUID
 */
export function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}