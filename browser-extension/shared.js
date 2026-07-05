// Shared config + API client for the HumanFlow extension.
// No bundler — plain ES modules loaded via <script type="module">.

export const DEFAULTS = {
  baseUrl: "http://localhost:3000",
  apiKey: "",
};

export async function getSettings() {
  const stored = await chrome.storage.sync.get(["baseUrl", "apiKey"]);
  return {
    baseUrl: (stored.baseUrl || DEFAULTS.baseUrl).replace(/\/+$/, ""),
    apiKey: stored.apiKey || "",
  };
}

export async function saveSettings(settings) {
  await chrome.storage.sync.set(settings);
}

/** The rewrite "modes" hit /api/v1/humanize; the tools hit /api/v1/tools. */
export const OPERATIONS = [
  { id: "Humanize", label: "Humanize", kind: "humanize" },
  { id: "Professional", label: "Professional", kind: "humanize" },
  { id: "Academic", label: "Academic", kind: "humanize" },
  { id: "Simplify", label: "Simplify", kind: "humanize" },
  { id: "Friendly", label: "Friendly", kind: "humanize" },
  { id: "grammar", label: "Fix Grammar", kind: "tool" },
  { id: "paraphrase", label: "Paraphrase", kind: "tool" },
  { id: "summarize", label: "Summarize", kind: "tool" },
  { id: "translate", label: "Translate", kind: "tool", needsOption: "targetLang", optionLabel: "Language" },
  { id: "detect", label: "Detect AI", kind: "tool" },
];

/**
 * Runs an operation and returns { output, meta }. Throws Error with a
 * user-readable message on failure.
 */
export async function runOperation(op, text, option) {
  const { baseUrl, apiKey } = await getSettings();
  if (!apiKey) throw new Error("Add your API key in the extension options first.");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  let url, body;
  if (op.kind === "humanize") {
    url = `${baseUrl}/api/v1/humanize`;
    body = { text, mode: op.id };
  } else {
    url = `${baseUrl}/api/v1/tools`;
    body = { tool: op.id, text };
    if (op.needsOption && option) body.options = { [op.needsOption]: option };
  }

  let res;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    throw new Error(`Couldn't reach ${baseUrl}. Check the server URL in options.`);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status}).`);
  }

  // /humanize returns { improved_text }, /tools returns { output }
  const output = data.improved_text ?? data.output ?? "";
  return { output, meta: data };
}
