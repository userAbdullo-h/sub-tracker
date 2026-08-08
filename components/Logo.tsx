"use client";

import { useState } from "react";
import { CATEGORY_ICONS, PURCHASE_ICON } from "@/lib/vendors";

/**
 * Service logo tile with graceful fallbacks:
 * 1. real favicon of the service (via Google's favicon endpoint)
 * 2. 3D category icon (generated, /public/icons)
 * 3. color-hashed letter tile
 */
export default function Logo({
  name,
  domain,
  category,
  kind = "subscription",
}: {
  name: string;
  domain?: string;
  category?: string;
  kind?: "subscription" | "purchase";
}) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);

  if (domain && !faviconFailed) {
    return (
      <span className="avatar logo-tile">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
          alt=""
          loading="lazy"
          onError={() => setFaviconFailed(true)}
        />
      </span>
    );
  }

  const icon = kind === "purchase" ? PURCHASE_ICON[category ?? "Other"] : CATEGORY_ICONS[category ?? "Other"];
  if (icon && !iconFailed) {
    return (
      <span className="avatar logo-tile icon-tile">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt="" loading="lazy" onError={() => setIconFailed(true)} />
      </span>
    );
  }

  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span
      className="avatar"
      style={{ background: `linear-gradient(135deg, hsl(${h},62%,52%), hsl(${(h + 40) % 360},62%,42%))` }}
    >
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
