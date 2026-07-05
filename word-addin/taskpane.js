/* global Office, Word */

// Rewrite "modes" call /api/v1/humanize; tools call /api/v1/tools.
const OPERATIONS = [
  { id: "Humanize", label: "Humanize", kind: "humanize" },
  { id: "Professional", label: "Professional", kind: "humanize" },
  { id: "Academic", label: "Academic", kind: "humanize" },
  { id: "Simplify", label: "Simplify", kind: "humanize" },
  { id: "grammar", label: "Fix Grammar", kind: "tool" },
  { id: "paraphrase", label: "Paraphrase", kind: "tool" },
  { id: "summarize", label: "Summarize", kind: "tool" },
  { id: "translate", label: "Translate", kind: "tool", needsOption: "targetLang", optionLabel: "Language" },
];

const $ = (id) => document.getElementById(id);

function loadSettings() {
  return {
    apiKey: localStorage.getItem("hf_apiKey") || "",
    baseUrl: (localStorage.getItem("hf_baseUrl") || "http://localhost:3000").replace(/\/+$/, ""),
  };
}

function currentOp() {
  return OPERATIONS.find((o) => o.id === $("operation").value) ?? OPERATIONS[0];
}

function showError(msg) {
  $("error").textContent = msg;
  $("error").hidden = false;
}

function showStatus(msg) {
  $("status").textContent = msg;
  $("status").hidden = !msg;
}

async function callApi(op, text, option) {
  const { apiKey, baseUrl } = loadSettings();
  if (!apiKey) throw new Error("Enter your API key and Save settings first.");

  const isHumanize = op.kind === "humanize";
  const url = `${baseUrl}/api/v1/${isHumanize ? "humanize" : "tools"}`;
  const body = isHumanize
    ? { text, mode: op.id }
    : { tool: op.id, text, ...(op.needsOption && option ? { options: { [op.needsOption]: option } } : {}) };

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`Couldn't reach ${baseUrl}. Check the Server URL.`);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
  return data.improved_text ?? data.output ?? "";
}

Office.onReady((info) => {
  if (info.host !== Office.HostType.Word) return;

  // Populate settings and operations
  const s = loadSettings();
  $("apiKey").value = s.apiKey;
  $("baseUrl").value = s.baseUrl;

  for (const op of OPERATIONS) {
    const o = document.createElement("option");
    o.value = op.id;
    o.textContent = op.label;
    $("operation").appendChild(o);
  }

  function syncOption() {
    const op = currentOp();
    if (op.needsOption) {
      $("option").hidden = false;
      $("option").placeholder = op.optionLabel ?? "Option";
      if (op.id === "translate" && !$("option").value) $("option").value = "Spanish";
    } else {
      $("option").hidden = true;
    }
  }
  $("operation").addEventListener("change", syncOption);
  syncOption();

  $("saveSettings").addEventListener("click", () => {
    localStorage.setItem("hf_apiKey", $("apiKey").value.trim());
    localStorage.setItem("hf_baseUrl", ($("baseUrl").value.trim() || "http://localhost:3000").replace(/\/+$/, ""));
    showStatus("Settings saved.");
    setTimeout(() => showStatus(""), 1500);
  });

  $("run").addEventListener("click", runOnSelection);
});

async function runOnSelection() {
  $("error").hidden = true;
  showStatus("");

  try {
    await Word.run(async (context) => {
      const selection = context.document.getSelection();
      selection.load("text");
      await context.sync();

      const text = (selection.text || "").trim();
      if (!text) {
        showError("Select some text in the document first.");
        return;
      }

      $("run").disabled = true;
      showStatus("Working…");

      const output = await callApi(currentOp(), text, $("option").value.trim());

      // Replace the selection with the result, keeping it as one range
      selection.insertText(output, Word.InsertLocation.replace);
      await context.sync();
      showStatus("Done — selection replaced.");
      setTimeout(() => showStatus(""), 2000);
    });
  } catch (err) {
    showError(err.message || "Something went wrong.");
  } finally {
    $("run").disabled = false;
  }
}
