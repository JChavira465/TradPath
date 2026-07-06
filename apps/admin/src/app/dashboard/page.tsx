"use client";

import { useAdminDashboard } from "@/hooks/use-admin-dashboard";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-white/40">{sub}</div>}
    </div>
  );
}

export default function ExecutiveDashboardPage() {
  const { data, isLoading } = useAdminDashboard();

  if (isLoading || !data) {
    return <p className="text-sm text-white/60">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white">Executive Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Companies" value={String(data.companyCount)} />
        <StatCard label="Users" value={String(data.userCount)} />
        <StatCard label="Platform MRR" value={`$${data.platformMrr.toFixed(2)}`} />
        <StatCard label="Platform ARR" value={`$${data.platformArr.toFixed(2)}`} />
        <StatCard label="Trials Ending (7d)" value={String(data.trialsEndingSoon)} />
        <StatCard label="Churned (30d)" value={String(data.planGrowthChurn.churnedLast30Days)} />
        <StatCard label="Failed Payments (30d)" value={String(data.failedPaymentsLast30Days)} />
        <StatCard label="Open Tickets" value={String(data.openTicketCount)} />
        <StatCard label="Storage Used" value={`${(data.storageUsedBytes / 1_000_000).toFixed(1)} MB`} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 font-medium text-white">Orgs by Tier</h2>
          <div className="space-y-1 text-sm text-white/70">
            {Object.entries(data.orgsByTier).map(([tier, count]) => (
              <div key={tier} className="flex justify-between">
                <span>{tier}</span>
                <span>{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 font-medium text-white">AI Usage by Plan</h2>
          <div className="space-y-1 text-sm text-white/70">
            {data.aiUsage.map((row) => (
              <div key={row.plan} className="flex justify-between">
                <span>{row.plan} ({row.orgCount} orgs)</span>
                <span>
                  {row.creditsUsed} / {row.creditsLimit === null ? "∞" : row.creditsLimit}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 font-medium text-white">Service Plans by Status</h2>
          <div className="space-y-1 text-sm text-white/70">
            {Object.entries(data.planGrowthChurn.byStatus).map(([status, count]) => (
              <div key={status} className="flex justify-between">
                <span>{status}</span>
                <span>{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 font-medium text-white">Bookings by Status</h2>
          <div className="space-y-1 text-sm text-white/70">
            {Object.entries(data.bookingsByStatus).length === 0 && <p className="text-white/40">No bookings yet.</p>}
            {Object.entries(data.bookingsByStatus).map(([status, count]) => (
              <div key={status} className="flex justify-between">
                <span>{status}</span>
                <span>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
