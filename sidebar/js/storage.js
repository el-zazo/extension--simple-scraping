// Storage operations for Simple Web Scraper extension

/**
 * Generic function to get data from Chrome storage
 * @param {string|Array|Object} keys - Keys to get from storage
 * @param {Function} callback - Function to call with retrieved data
 */
export function get(keys, callback) {
  chrome.storage.local.get(keys, (data) => {
    callback(data);
  });
}

/**
 * Generic function to set data in Chrome storage
 * @param {Object} data - Data object to save to storage
 * @param {Function} [callback] - Optional callback function to execute after saving
 */
export function set(data, callback) {
  chrome.storage.local.set(data, () => {
    if (callback && typeof callback === 'function') {
      callback();
    }
  });
}

/**
 * Load schemas from Chrome storage
 * @param {Function} callback - Function to call with loaded schemas
 */
export function loadSchemas(callback) {
  get('schemas', (data) => {
    if (data.schemas && Array.isArray(data.schemas)) {
      callback(data.schemas);
    } else {
      callback([]);
    }
  });
}

/**
 * Save schemas to Chrome storage
 * @param {Array} schemas - Array of schema objects to save
 * @param {Function} [callback] - Optional callback function to execute after saving
 */
export function saveSchemas(schemas, callback) {
  set({ schemas: schemas }, () => {
    console.log('Schemas saved to storage');
    if (callback && typeof callback === 'function') {
      callback();
    }
  });
}