import type { Metadata } from "next";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import ToolsWorkspace from "./ToolsWorkspace";
import "../page.css";

export const metadata: Metadata = {
  title: "Writing Tools — HumanFlow",
  description:
    "AI detector, grammar checker, paraphraser, summarizer, translator, tone changer, citation generator, plagiarism checker, and text analyzer.",
};

export default function ToolsPage() {
  return (
    <div className="hf-page">
      <Nav />
      <ToolsWorkspace />
      <Footer />
    </div>
  );
}
