"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FavoriteStar({ id, favorite }: { id: string; favorite: boolean }) {
  const router = useRouter();
  const [fav, setFav] = useState(favorite);

  async function toggle() {
    setFav(!fav);
    const res = await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !fav }),
    });
    if (!res.ok) setFav(fav);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      className="hf-dash-star"
      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
      title={fav ? "Remove from favorites" : "Add to favorites"}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill={fav ? "#FFB020" : "none"} stroke={fav ? "#FFB020" : "#A6AEBE"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.8 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z" />
      </svg>
    </button>
  );
}
