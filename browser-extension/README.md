# HumanFlow Browser Extension

A Manifest V3 Chrome/Edge extension that runs HumanFlow's AI writing tools on
any text, using the public API (`/api/v1/humanize`, `/api/v1/tools`).

## Load it (unpacked, for development)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this `browser-extension/` folder.
4. Click the HumanFlow icon → the ⚙ settings, and enter:
   - **API key** — from your dashboard → API keys (`hf_live_…`)
   - **Server URL** — `http://localhost:3000` for local dev, or your deployed
     URL once the app is live.

## Use it

- Click the toolbar icon, paste or auto-fill selected text, pick an operation
  (Humanize, Fix Grammar, Paraphrase, Summarize, Translate, Detect AI, …), and
  **Run**. Copy the result with one click.
- Or **right-click any selected text** on a page → *Humanize with HumanFlow*.

## Notes

- The API key is stored with `chrome.storage.sync` and sent only to the server
  URL you configure — nowhere else.
- `host_permissions` includes `https://*/*` so the extension can call your
  deployed instance on any domain; narrow this to your real domain before
  publishing to the Chrome Web Store.
- Words consumed count against the account's monthly quota, same as the web app.
