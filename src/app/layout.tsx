import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iman x Zaal — Action Tracker",
  description: "ZAO Devz, WaveWarZ Zambia, social ops, POIDH bounty.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
