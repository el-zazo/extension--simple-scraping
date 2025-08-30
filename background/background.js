// Background script for Simple Web Scraper extension

// Listen for extension icon clicks
chrome.action.onClicked.addListener((tab) => {
  // Send a message to the content script to toggle the sidebar
  chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" }, (response) => {
    // If the content script hasn't been injected yet (e.g., on browser restart),
    // we need to inject it first
    if (chrome.runtime.lastError) {
      // Inject the content script
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          files: ["content/content.js"],
        },
        () => {
          // After injection, send the toggle message again
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" });
          }, 100);
        }
      );
    }
  });
});
