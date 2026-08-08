"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const tabs = [
  { href: "/", label: "Dashboard" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/purchases", label: "Purchases" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header>
      <div className="brand">
        <div className="logo">💳</div>
        <div>
          <h1>PayPilot</h1>
          <div className="tagline">subscriptions · purchases · renewals</div>
        </div>
      </div>
      <nav>
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={pathname === t.href ? "active" : ""}>
            {t.label}
          </Link>
        ))}
        <ThemeToggle />
      </nav>
    </header>
  );
}
