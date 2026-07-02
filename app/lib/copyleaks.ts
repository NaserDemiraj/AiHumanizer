import "server-only";

/**
 * Copyleaks v3 plagiarism API. Results arrive via webhook, so real scans
 * require PUBLIC_BASE_URL to be a publicly reachable https URL. On
 * localhost the plagiarism tool falls back to the LLM estimate.
 */

let cachedToken: { token: string; expiresAt: number } | null = null;

export function copyleaksConfigured(): boolean {
  return Boolean(process.env.COPYLEAKS_EMAIL && process.env.COPYLEAKS_KEY);
}

export function copyleaksWebhooksReachable(): boolean {
  const base = process.env.PUBLIC_BASE_URL ?? "";
  return base.startsWith("https://") && !base.includes("localhost");
}

export async function getCopyleaksToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const res = await fetch("https://id.copyleaks.com/v3/account/login/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.COPYLEAKS_EMAIL,
      key: process.env.COPYLEAKS_KEY,
    }),
  });
  if (!res.ok) {
    throw new Error(`Copyleaks login failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string };
  // Tokens last 48h; refresh after 40h to stay clear of expiry
  cachedToken = { token: data.access_token, expiresAt: Date.now() + 40 * 60 * 60 * 1000 };
  return data.access_token;
}

/**
 * Submits `text` for a plagiarism scan. `scanId` doubles as our Document id
 * so the completion webhook can find the record to update.
 */
export async function submitPlagiarismScan(text: string, scanId: string): Promise<void> {
  const token = await getCopyleaksToken();
  const base = process.env.PUBLIC_BASE_URL!.replace(/\/$/, "");
  const sandbox = (process.env.COPYLEAKS_SANDBOX ?? "true") !== "false";

  const res = await fetch(`https://api.copyleaks.com/v3/scans/submit/file/${scanId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      base64: Buffer.from(text, "utf-8").toString("base64"),
      filename: "document.txt",
      properties: {
        sandbox,
        webhooks: {
          status: `${base}/api/webhooks/copyleaks/{STATUS}/${scanId}`,
        },
      },
    }),
  });

  if (!res.ok && res.status !== 201) {
    throw new Error(`Copyleaks submit failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
}

export type CopyleaksCompletedPayload = {
  status?: number;
  scannedDocument?: { scanId: string; totalWords: number; credits: number };
  results?: {
    score?: {
      identicalWords: number;
      minorChangedWords: number;
      relatedMeaningWords: number;
      aggregatedScore: number;
    };
    internet?: { url: string; title: string; matchedWords: number }[];
    database?: { id: string; matchedWords: number }[];
  };
};
