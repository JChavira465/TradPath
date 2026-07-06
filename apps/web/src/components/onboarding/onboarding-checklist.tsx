"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { useDismissOnboarding, useOnboardingChecklist } from "@/hooks/use-onboarding";

export function OnboardingChecklistWidget() {
  const { data, isLoading } = useOnboardingChecklist();
  const dismiss = useDismissOnboarding();
  const wasAllDone = useRef(false);

  useEffect(() => {
    if (data?.allDone && !wasAllDone.current) {
      wasAllDone.current = true;
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }
  }, [data?.allDone]);

  if (isLoading || !data || data.dismissed) {
    return null;
  }

  const progressPercent = Math.round((data.completedCount / data.totalCount) * 100);

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-medium text-navy">Get set up</h2>
          <p className="text-sm text-gray-500">
            {data.completedCount} of {data.totalCount} steps done
          </p>
        </div>
        <button className="text-xs text-gray-400 hover:text-navy" onClick={() => dismiss.mutate()}>
          Dismiss
        </button>
      </div>

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full bg-brand transition-all" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="space-y-2">
        {data.items.map((item) => (
          <div key={item.key} className="flex items-center gap-2 text-sm">
            <span className={item.done ? "text-green-600" : "text-gray-300"}>{item.done ? "✓" : "○"}</span>
            {item.done ? (
              <span className="text-gray-400 line-through">{item.label}</span>
            ) : (
              <Link href={item.actionHref} className="text-gray-700 hover:text-brand hover:underline">
                {item.label}
              </Link>
            )}
          </div>
        ))}
      </div>

      {data.allDone && (
        <p className="mt-4 text-sm font-medium text-green-600">🎉 You're all set up — nice work!</p>
      )}
    </div>
  );
}
