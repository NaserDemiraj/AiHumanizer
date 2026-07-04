"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TrashActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function restore() {
    setPending(true);
    await fetch(`/api/documents/${id}/restore`, { method: "POST" });
    router.refresh();
  }

  async function deleteForever() {
    setPending(true);
    await fetch(`/api/documents/${id}?permanent=true`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="hf-trash-actions">
      <button className="hf-dash-small-btn" type="button" disabled={pending} onClick={() => void restore()}>
        Restore
      </button>
      <button className="hf-trash-delete" type="button" disabled={pending} onClick={() => void deleteForever()}>
        Delete forever
      </button>
    </div>
  );
}
