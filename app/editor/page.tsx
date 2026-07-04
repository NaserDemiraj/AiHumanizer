import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../lib/auth";
import Nav from "../components/Nav";
import NewDocumentLauncher from "./NewDocumentLauncher";
import "../page.css";

export const metadata: Metadata = {
  title: "Editor — HumanFlow",
};

export default async function EditorLandingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="hf-page">
      <Nav />
      <NewDocumentLauncher />
    </div>
  );
}
