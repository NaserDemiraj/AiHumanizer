"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FavoriteToggle({ id, favorite }: { id: string; favorite: boolean }) {
  const router = useRouter();
  const [fav, setFav] = useState(favorite);
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    setFav(!fav);
    const res = await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !fav }),
    });
    if (!res.ok) setFav(fav);
    setPending(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`hf-doc-fav${fav ? " hf-doc-fav-on" : ""}`}
      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
      title={fav ? "Remove from favorites" : "Add to favorites"}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill={fav ? "#FFB020" : "none"} stroke={fav ? "#FFB020" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.8 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z" />
      </svg>
      {fav ? "Favorited" : "Favorite"}
    </button>
  );
}

export function DeleteDocInline({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <button onClick={handleDelete} disabled={pending} className="hf-doc-delete-btn">
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
