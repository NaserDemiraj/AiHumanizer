import { OPERATIONS, runOperation, getSettings } from "./shared.js";

const $ = (id) => document.getElementById(id);
const textEl = $("text");
const opEl = $("operation");
const optionEl = $("option");
const runEl = $("run");
const errorEl = $("error");
const resultWrap = $("result-wrap");
const resultEl = $("result");

// Populate operations
for (const op of OPERATIONS) {
  const o = document.createElement("option");
  o.value = op.id;
  o.textContent = op.label;
  opEl.appendChild(o);
}

function currentOp() {
  return OPERATIONS.find((o) => o.id === opEl.value) ?? OPERATIONS[0];
}

function syncOptionField() {
  const op = currentOp();
  if (op.needsOption) {
    optionEl.hidden = false;
    optionEl.placeholder = op.optionLabel ?? "Option";
    if (op.id === "translate" && !optionEl.value) optionEl.value = "Spanish";
  } else {
    optionEl.hidden = true;
  }
}
opEl.addEventListener("change", syncOptionField);
syncOptionField();

// Prefill from the page's current selection
async function loadSelection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() ?? "",
    });
    if (result && result.trim()) textEl.value = result.trim();
  } catch {
    // Some pages (chrome://, store) disallow scripting — silently skip
  }
}

// Show the no-key banner if needed
(async () => {
  const { apiKey } = await getSettings();
  $("no-key").hidden = Boolean(apiKey);
  // Also restore any pending text passed from the context menu
  const { pendingText } = await chrome.storage.local.get("pendingText");
  if (pendingText) {
    textEl.value = pendingText;
    await chrome.storage.local.remove("pendingText");
  } else {
    await loadSelection();
  }
})();

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

runEl.addEventListener("click", async () => {
  errorEl.hidden = true;
  resultWrap.hidden = true;
  const text = textEl.value.trim();
  if (!text) {
    showError("Enter or select some text first.");
    return;
  }

  runEl.disabled = true;
  runEl.textContent = "Working…";
  try {
    const { output } = await runOperation(currentOp(), text, optionEl.value.trim());
    resultEl.textContent = output;
    resultWrap.hidden = false;
  } catch (err) {
    showError(err.message);
  } finally {
    runEl.disabled = false;
    runEl.textContent = "Run";
  }
});

$("copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(resultEl.textContent);
  $("copy").textContent = "Copied ✓";
  setTimeout(() => ($("copy").textContent = "Copy"), 1500);
});

for (const link of [$("settings-link"), $("open-options")]) {
  link?.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}
