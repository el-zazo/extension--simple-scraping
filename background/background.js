// Background script for Simple Web Scraper extension

// Listen for extension icon clicks
chrome.action.onClicked.addListener((tab) => {
  // Send a message to the content script to toggle the sidebar
  chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" }, (response) => {
    // If the content script hasn't been injected yet (e.g., on browser restart),
    // we need to inject it first
    if (chrome.runtime.lastError) {
      // Set up a one-time listener for the content script's "ready" message
      const readyListener = (message, sender, sendResponse) => {
        if (message.action === "contentScriptReady" && sender.tab && sender.tab.id === tab.id) {
          chrome.runtime.onMessage.removeListener(readyListener);
          // Now that the content script is initialized, send the toggle message
          chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" });
        }
      };
      chrome.runtime.onMessage.addListener(readyListener);

      // Inject the content script
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          files: ["content/content.js"],
        },
        () => {
          // The content script will send "contentScriptReady" once initialized;
          // the listener above will handle sending "toggleSidebar" in response.
          // If injection itself failed, clean up the listener.
          if (chrome.runtime.lastError) {
            chrome.runtime.onMessage.removeListener(readyListener);
          }
        }
      );
    }
  });
});
