import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "HumanFlow — Write naturally. Publish confidently.",
  description:
    "Humanize AI-generated content, detect AI writing, check plagiarism, rewrite text naturally, improve readability, and optimize your writing — all in one intelligent platform.",
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
      </body>
    </html>
  );
}
