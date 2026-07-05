import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import ChatWidget from "./components/ChatWidget";
import { SITE_URL } from "./lib/siteUrl";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const TITLE = "HumanFlow — Write naturally. Publish confidently.";
const DESCRIPTION =
  "Humanize AI-generated content, detect AI writing, check plagiarism, rewrite text naturally, improve readability, and optimize your writing — all in one intelligent platform.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · HumanFlow",
  },
  description: DESCRIPTION,
  applicationName: "HumanFlow",
  keywords: [
    "AI humanizer",
    "humanize AI text",
    "AI detector",
    "plagiarism checker",
    "paraphrasing tool",
    "grammar checker",
    "PDF to Word",
    "document editor",
  ],
  authors: [{ name: "HumanFlow" }],
  openGraph: {
    type: "website",
    siteName: "HumanFlow",
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "HumanFlow" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body style={{ fontFamily: "var(--font-plus-jakarta-sans), -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
