# HumanFlow Word Add-in

An Office.js task-pane add-in that runs HumanFlow's AI tools on the selected
text in a Word document and replaces it in place. It calls the same public API
as the web app and browser extension (`/api/v1/humanize`, `/api/v1/tools`).

## Important: Office add-ins require HTTPS

Even for local development, Word will only load an add-in whose `SourceLocation`
is served over **https** — plain `http://localhost:3000` won't work. Two paths:

### Option A — serve locally over HTTPS (dev)

1. Generate a trusted localhost cert:
   ```
   npx office-addin-dev-certs install
   ```
2. Serve this folder over https on port 3000 (any static https server works),
   or reverse-proxy `/word-addin/*` from your Next app behind https.
3. The `manifest.xml` URLs already point at
   `https://localhost:3000/word-addin/...` — adjust if you use another port.

### Option B — host on your deployed site (production)

Once HumanFlow is deployed over https, copy this folder to the site (e.g.
`public/word-addin/`) and change every URL in `manifest.xml` from
`https://localhost:3000` to your domain.

## Sideload the add-in

1. In Word: **Insert → Add-ins → My Add-ins → Upload My Add-in**.
2. Choose this folder's `manifest.xml`.
3. The HumanFlow pane opens. Enter your **API key** (dashboard → API keys) and
   **Server URL**, then **Save settings**.

## Use it

Select text in the document, pick an operation (Humanize, Fix Grammar,
Paraphrase, Summarize, Translate, …), and **Run on selected text** — the result
replaces your selection. Words consumed count against your account quota.

## Files

- `manifest.xml` — add-in definition (ID, permissions, source location)
- `taskpane.html` / `.css` / `.js` — the pane UI and Office.js logic
- `icons/` — ribbon/pane icons
