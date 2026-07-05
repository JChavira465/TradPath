"use client";

import { useEffect, useId, useRef } from "react";
import Script from "next/script";

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
    };
  }
}

// Renders nothing (and the backend soft-passes) when no site key is
// configured yet — same "works without it, upgrades automatically once
// configured" pattern as the other not-yet-provisioned integrations.
export function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerId = useId().replace(/:/g, "");
  const rendered = useRef(false);

  useEffect(() => {
    if (!siteKey || rendered.current || !window.turnstile) return;
    rendered.current = true;
    window.turnstile.render(`#${containerId}`, {
      sitekey: siteKey,
      callback: onToken,
    });
  });

  if (!siteKey) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div id={containerId} />
    </>
  );
}
