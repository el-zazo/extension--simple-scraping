# Simple Web Scraper

A browser extension for web data scraping with schema management.

## Features

- **Sidebar Interface**: A user-friendly sidebar that opens on the left side of the web page
- **Schema Management**: Create, edit, and delete scraping schemas
- **Column Configuration**: Define columns with CSS selectors and data types
- **Scraping**: Extract data from web pages based on your schemas
- **Export**: Export scraped data to CSV and JSON formats

## Installation

### Chrome/Edge

1. Download or clone this repository
2. Open Chrome/Edge and navigate to `chrome://extensions` or `edge://extensions`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. The extension should now appear in your browser toolbar

### Firefox

1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..."
4. Select the `manifest.json` file in the extension directory
5. The extension should now appear in your browser toolbar

## Usage

1. Navigate to a website you want to scrape
2. Click the Simple Web Scraper icon in your browser toolbar
3. The sidebar will open on the left side of the page
4. Create a new schema by clicking "Add Schema"
5. Define your schema with a name, description, and columns
6. For each column, specify:
   - Name: A descriptive name for the column
   - CSS Selector: The CSS selector to target the data
   - Type: The type of data to extract (text, HTML, attribute, etc.)
   - Attribute Name: Required if type is 'attribute'
   - Multiple Elements: Check if you want to extract data from multiple matching elements
7. Save your schema
8. Click "Start Scraping" to extract data
9. View the results in the table
10. Click "Export CSV" to download the data as a CSV file or "Export JSON" for JSON format

## License

ISC