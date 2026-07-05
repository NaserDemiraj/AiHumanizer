import { describe, it, expect, beforeAll } from "vitest";

/**
 * Integration tests for the document platform HTTP layer against a LIVE dev
 * server (npm run dev on :3000) and the real database. Deliberately exercises
 * the NON-LLM paths (create, save, versions CRUD, convert, original download,
 * trash/restore) so it's fast and burns no Groq quota.
 *
 * Skips itself automatically if no server is reachable.
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function serverReachable(): Promise<boolean> {
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

function extractCookie(res: Response): string {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("Expected a Set-Cookie header, got none");
  return setCookie.split(";")[0];
}

describe("document platform", () => {
  let cookie: string;
  let available = false;

  beforeAll(async () => {
    available = await serverReachable();
    if (!available) {
      console.warn(`\n[skipped] No server at ${BASE_URL}. Run "npm run dev" first.\n`);
      return;
    }
    const email = `doc-vitest-${Date.now()}@example.com`;
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Doc Vitest", email, password: "testpassword123" }),
    });
    expect(res.status).toBe(201);
    cookie = extractCookie(res);
  });

  it("requires auth for document creation", async () => {
    if (!available) return;
    const res = await fetch(`${BASE_URL}/api/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "x", text: "y" }),
    });
    expect(res.status).toBe(401);
  });

  it("creates a blank editor document", async () => {
    if (!available) return;
    const res = await fetch(`${BASE_URL}/api/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ title: "Test Doc", text: "First paragraph.\n\nSecond paragraph." }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeTruthy();
  });

  it("saves editor content, snapshots a version, then lists/renames/deletes it", async () => {
    if (!available) return;

    // create
    const created = await fetch(`${BASE_URL}/api/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ title: "Versioned", text: "original text" }),
    }).then((r) => r.json());
    const id = created.id;

    // save content (PATCH)
    const patch = await fetch(`${BASE_URL}/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        content: { doc: { type: "doc" }, html: "<p>edited</p>" },
        text: "edited",
      }),
    });
    expect(patch.status).toBe(200);

    // create a version snapshot
    const ver = await fetch(`${BASE_URL}/api/documents/${id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ op: "manual", label: "Snapshot A", text: "original text" }),
    });
    expect(ver.status).toBe(201);
    const versionId = (await ver.json()).id;

    // list
    const list = await fetch(`${BASE_URL}/api/documents/${id}/versions`, {
      headers: { Cookie: cookie },
    }).then((r) => r.json());
    expect(list.length).toBe(1);
    expect(list[0].label).toBe("Snapshot A");

    // rename
    const rename = await fetch(`${BASE_URL}/api/documents/${id}/versions/${versionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ label: "Renamed" }),
    });
    expect(rename.status).toBe(200);

    // full version content is fetchable
    const full = await fetch(`${BASE_URL}/api/documents/${id}/versions/${versionId}`, {
      headers: { Cookie: cookie },
    }).then((r) => r.json());
    expect(full.label).toBe("Renamed");
    expect(full.text).toBe("original text");

    // delete
    const del = await fetch(`${BASE_URL}/api/documents/${id}/versions/${versionId}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(del.status).toBe(200);
    const afterList = await fetch(`${BASE_URL}/api/documents/${id}/versions`, {
      headers: { Cookie: cookie },
    }).then((r) => r.json());
    expect(afterList.length).toBe(0);
  });

  it("soft-deletes to trash, then restores", async () => {
    if (!available) return;
    const id = (
      await fetch(`${BASE_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ title: "Trash me", text: "content" }),
      }).then((r) => r.json())
    ).id;

    const trashed = await fetch(`${BASE_URL}/api/documents/${id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    }).then((r) => r.json());
    expect(trashed.trashed).toBe(true);

    const restored = await fetch(`${BASE_URL}/api/documents/${id}/restore`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(restored.status).toBe(200);
  });

  it("converts an uploaded TXT to DOCX (no AI, no word quota)", async () => {
    if (!available) return;
    const form = new FormData();
    form.append(
      "file",
      new File(["The Title\n\nBody paragraph one.\n\nBody paragraph two."], "src.txt", {
        type: "text/plain",
      }),
    );
    form.append("target", "docx");

    const res = await fetch(`${BASE_URL}/api/convert`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: form,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("wordprocessingml");
    const buf = Buffer.from(await res.arrayBuffer());
    // DOCX is a zip → starts with "PK"
    expect(buf.subarray(0, 2).toString()).toBe("PK");
  });

  it("uploads a file then streams back the stored original byte-for-byte", async () => {
    if (!available) return;
    const original = "This exact content must round-trip.\n\nSecond line.";
    const form = new FormData();
    form.append("file", new File([original], "roundtrip.txt", { type: "text/plain" }));

    const created = await fetch(`${BASE_URL}/api/documents`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: form,
    });
    expect(created.status).toBe(201);
    const id = (await created.json()).id;

    const dl = await fetch(`${BASE_URL}/api/documents/${id}/original`, {
      headers: { Cookie: cookie },
    });
    expect(dl.status).toBe(200);
    expect(await dl.text()).toBe(original);
  });

  it("rejects an unsupported file type on convert", async () => {
    if (!available) return;
    const form = new FormData();
    // A tiny fake MP4 header — recognized binary, unsupported for docs
    const mp4 = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
    ]);
    form.append("file", new File([mp4], "clip.mp4", { type: "video/mp4" }));
    form.append("target", "pdf");

    const res = await fetch(`${BASE_URL}/api/convert`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: form,
    });
    expect(res.status).toBe(400);
  });
});
