import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioMonk — NEET Biology Platform",
  description:
    "BioMonk is an advanced NEET Biology learning platform by Vicky Vaswani. Study, practice, and track your progress for NEET 2027.",
  keywords: ["NEET", "Biology", "BioMonk", "Vicky Vaswani", "NEET 2027", "Coaching"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
