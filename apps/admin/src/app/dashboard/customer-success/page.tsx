"use client";

import { useAtRiskOrgs } from "@/hooks/use-admin-platform-reports";

const SIGNAL_LABEL: Record<string, string> = {
  LOW_HEALTH_SCORE: "Low health score",
  NO_RECENT_LOGIN: "No recent login",
  REPEATED_FAILED_PAYMENTS: "Repeated failed payments",
  NO_USAGE: "No usage",
};

export default function CustomerSuccessPage() {
  const { data, isLoading } = useAtRiskOrgs();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Customer Success — At-Risk Companies</h1>

      {isLoading || !data ? (
        <p className="text-sm text-white/60">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-white/40">No at-risk companies detected right now.</p>
      ) : (
        <div className="space-y-2">
          {data.map((org) => (
            <div key={org.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium text-white">{org.name}</div>
                <div className="text-xs text-white/50">
                  {org.plan} / {org.status}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {org.signals.map((s) => (
                  <span key={s} className="rounded-full bg-red-600/20 px-2 py-0.5 text-xs text-red-300">
                    {SIGNAL_LABEL[s] ?? s}
                  </span>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-white/50 md:grid-cols-4">
                <div>Health: {org.healthScore ?? "—"}</div>
                <div>Last login: {org.lastLoginAt ? new Date(org.lastLoginAt).toLocaleDateString() : "never"}</div>
                <div>Failed payments: {org.failedPaymentCount}</div>
                <div>
                  Usage: {org.jobCount} jobs / {org.invoiceCount} invoices
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
