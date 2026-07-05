import type { Metadata } from "next";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import ConvertClient from "./ConvertClient";
import "../page.css";

export const metadata: Metadata = {
  title: "File Converter",
  description: "Convert PDF, DOCX, DOC, RTF, ODT, TXT, and Markdown files between formats.",
};

export default function ConvertPage() {
  return (
    <div className="hf-page">
      <Nav />
      <ConvertClient />
      <Footer />
    </div>
  );
}
