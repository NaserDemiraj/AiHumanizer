import { getSettings, saveSettings, DEFAULTS } from "./shared.js";

const apiKeyEl = document.getElementById("apiKey");
const baseUrlEl = document.getElementById("baseUrl");
const savedEl = document.getElementById("saved");

(async () => {
  const settings = await getSettings();
  apiKeyEl.value = settings.apiKey;
  baseUrlEl.value = settings.baseUrl || DEFAULTS.baseUrl;
})();

document.getElementById("save").addEventListener("click", async () => {
  await saveSettings({
    apiKey: apiKeyEl.value.trim(),
    baseUrl: (baseUrlEl.value.trim() || DEFAULTS.baseUrl).replace(/\/+$/, ""),
  });
  savedEl.hidden = false;
  setTimeout(() => (savedEl.hidden = true), 1800);
});
