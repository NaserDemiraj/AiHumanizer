import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../lib/auth";
import Nav from "../components/Nav";
import BatchClient from "./BatchClient";
import "../page.css";

export const metadata: Metadata = {
  title: "Batch Processing — HumanFlow",
};

export default async function BatchPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="hf-page">
      <Nav />
      <BatchClient />
    </div>
  );
}
