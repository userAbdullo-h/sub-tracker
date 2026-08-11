"use client";

import { useEffect, useState } from "react";
import { Sun, MoonStars, CircleHalf } from "@phosphor-icons/react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<string | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("pp-theme", next); } catch {}
    setTheme(next);
  }

  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Toggle color theme" title="Toggle theme">
      {theme === null ? <CircleHalf size={16} /> : theme === "dark" ? <Sun size={16} weight="bold" /> : <MoonStars size={16} weight="bold" />}
    </button>
  );
}
