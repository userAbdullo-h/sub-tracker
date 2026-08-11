"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import type { DetectedEvent } from "@/lib/types";

const tabs = [
  { href: "/", label: "Dashboard" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/purchases", label: "Purchases" },
  { href: "/review", label: "Review" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  // Refresh the review badge whenever the route changes
  useEffect(() => {
    let alive = true;
    fetch("/api/detected")
      .then((r) => (r.ok ? r.json() : []))
      .then((events: DetectedEvent[]) => {
        if (alive) setPendingCount(events.filter((e) => e.status === "pending").length);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname]);

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
            {t.href === "/review" && pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
          </Link>
        ))}
        <ThemeToggle />
      </nav>
    </header>
  );
}
