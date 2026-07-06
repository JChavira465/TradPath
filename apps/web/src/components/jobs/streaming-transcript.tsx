"use client";

import { useEffect, useState } from "react";

// Whisper returns the full transcript in one response rather than token-by-
// token, so this simulates the streaming feel on the client by revealing
// the already-returned text progressively instead of dumping it all at once.
export function StreamingTranscript({ text }: { text: string }) {
  const [visibleChars, setVisibleChars] = useState(0);

  useEffect(() => {
    setVisibleChars(0);
    if (!text) return;
    const interval = setInterval(() => {
      setVisibleChars((n) => {
        if (n >= text.length) {
          clearInterval(interval);
          return n;
        }
        return n + Math.max(1, Math.floor(text.length / 60));
      });
    }, 16);
    return () => clearInterval(interval);
  }, [text]);

  return <p className="text-sm text-gray-700">{text.slice(0, visibleChars)}</p>;
}
