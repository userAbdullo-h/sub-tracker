import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "PayPilot — Subscriptions & Payments",
  description: "Personal subscription, purchase and API-usage autopilot",
};

const themeInit = `(function(){try{var t=localStorage.getItem("pp-theme");document.documentElement.dataset.theme=(t==="dark"||t==="light")?t:"light"}catch(e){document.documentElement.dataset.theme="light"}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <div className="aurora" aria-hidden="true"><span /><span /><span /></div>
        {children}
      </body>
    </html>
  );
}
