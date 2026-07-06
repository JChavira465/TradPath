"use client";

import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePlatformReportsSummary } from "@/hooks/use-admin-platform-reports";

export default function ReportsPage() {
  const { data, isLoading } = usePlatformReportsSummary();

  if (isLoading || !data) {
    return <p className="text-sm text-white/60">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Platform Reports</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 font-medium text-white">Signups (6 months)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.signupsTrend}>
              <XAxis dataKey="month" stroke="#ffffff60" fontSize={12} />
              <YAxis stroke="#ffffff60" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #ffffff20" }} />
              <Bar dataKey="signups" fill="#7C3AED" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 font-medium text-white">Revenue (6 months)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.revenueTrend}>
              <XAxis dataKey="month" stroke="#ffffff60" fontSize={12} />
              <YAxis stroke="#ffffff60" fontSize={12} />
              <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #ffffff20" }} />
              <Line type="monotone" dataKey="revenue" stroke="#7C3AED" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 font-medium text-white">Plan distribution</h2>
        <div className="flex gap-6 text-sm text-white/70">
          {Object.entries(data.planDistribution).map(([plan, count]) => (
            <div key={plan}>
              <div className="text-xs text-white/50">{plan}</div>
              <div className="text-lg font-semibold text-white">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
