// Service worker: adds a right-click "Humanize with HumanFlow" entry that
// stashes the selected text so the popup can pick it up when opened.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "humanflow-selection",
    title: "Humanize with HumanFlow",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === "humanflow-selection" && info.selectionText) {
    await chrome.storage.local.set({ pendingText: info.selectionText });
    // MV3 can't programmatically open the popup on all platforms; opening the
    // options-less action is best-effort. The text is stored either way, so
    // when the user clicks the toolbar icon the popup loads it.
    try {
      await chrome.action.openPopup();
    } catch {
      // Fall back silently — user clicks the toolbar icon to see it.
    }
  }
});
