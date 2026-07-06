"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { downloadReportFile, useReportsSummary } from "@/hooks/use-reports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function isoDateNDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function ReportsPage() {
  const [from, setFrom] = useState(isoDateNDaysAgo(30));
  const [to, setTo] = useState(new Date().toISOString());

  const { data, isLoading } = useReportsSummary({ from, to });

  if (isLoading || !data) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-navy">Reports</h1>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">From</label>
            <Input type="date" value={from.slice(0, 10)} onChange={(e) => setFrom(new Date(e.target.value).toISOString())} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">To</label>
            <Input
              type="date"
              value={to.slice(0, 10)}
              onChange={(e) => {
                const d = new Date(e.target.value);
                d.setHours(23, 59, 59, 999);
                setTo(d.toISOString());
              }}
            />
          </div>
          <Button variant="outline" onClick={() => downloadReportFile("csv", { from, to })}>
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => downloadReportFile("pdf", { from, to })}>
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Revenue (one-time)" value={`$${data.revenue.oneTime.toFixed(2)}`} />
        <StatCard label="Revenue (recurring)" value={`$${data.revenue.recurring.toFixed(2)}`} />
        <StatCard label="Completion Rate" value={`${data.completionRate}%`} />
        <StatCard label="Avg Job Value" value={`$${data.avgJobValue.toFixed(2)}`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-medium text-navy">MRR Trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.mrrTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
              <Line type="monotone" dataKey="mrr" stroke="#2563EB" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-gray-400">
            ARR: ${data.planGrowthChurn.arr.toFixed(2)} · {data.planGrowthChurn.activeCount} active plans ·{" "}
            {data.planGrowthChurn.newPlansInRange} new in range · {data.planGrowthChurn.churnedLast30Days} churned (30d)
          </p>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-medium text-navy">AR Aging</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={[
                { bucket: "Current", amount: data.arAging.buckets.current },
                { bucket: "1-30d", amount: data.arAging.buckets.days1to30 },
                { bucket: "31-60d", amount: data.arAging.buckets.days31to60 },
                { bucket: "61-90d", amount: data.arAging.buckets.days61to90 },
                { bucket: "90+d", amount: data.arAging.buckets.days90plus },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
              <Bar dataKey="amount" fill="#2563EB" />
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-gray-400">
            Total outstanding: ${data.arAging.totalOutstanding.toFixed(2)} across {data.arAging.invoiceCount} invoices
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-medium text-navy">Profit Per Job</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="pb-2">Job</th>
                <th className="pb-2 text-right">Revenue</th>
                <th className="pb-2 text-right">Labor</th>
                <th className="pb-2 text-right">Material</th>
                <th className="pb-2 text-right">Profit</th>
                <th className="pb-2 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.profitPerJob.map((job) => (
                <tr key={job.jobId}>
                  <td className="py-2">
                    #{job.jobNumber} {job.title}
                  </td>
                  <td className="py-2 text-right">${job.revenue.toFixed(2)}</td>
                  <td className="py-2 text-right text-gray-500">${job.laborCost.toFixed(2)}</td>
                  <td className="py-2 text-right text-gray-500">${job.materialCost.toFixed(2)}</td>
                  <td className="py-2 text-right font-medium">${job.profit.toFixed(2)}</td>
                  <td className={`py-2 text-right font-medium ${job.healthy ? "text-green-600" : "text-red-600"}`}>
                    {job.marginPercent !== null ? `${job.marginPercent}%` : "—"}
                  </td>
                </tr>
              ))}
              {data.profitPerJob.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    No completed jobs in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-medium text-navy">Top Customers</h2>
          <div className="space-y-2">
            {data.topCustomers.map((c) => (
              <div key={c.customerId} className="flex justify-between text-sm">
                <span className="text-gray-700">{c.name}</span>
                <span className="text-gray-500">
                  ${c.totalBilled.toFixed(2)} ({c.invoiceCount})
                </span>
              </div>
            ))}
            {data.topCustomers.length === 0 && <p className="text-sm text-gray-400">No invoices in this range.</p>}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-medium text-navy">Employee Hours</h2>
          <div className="space-y-2">
            {data.employeeHours.map((e) => (
              <div key={e.userId} className="flex justify-between text-sm">
                <span className="text-gray-700">{e.name}</span>
                <span className="text-gray-500">
                  {e.totalHours}h {e.overtimeHours > 0 && `(${e.overtimeHours}h OT)`}
                </span>
              </div>
            ))}
            {data.employeeHours.length === 0 && <p className="text-sm text-gray-400">No time entries in this range.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-2 font-medium text-navy">Booking Conversion</h2>
          <p className="text-2xl font-semibold text-navy">{data.bookingConversion.conversionRate}%</p>
          <p className="text-xs text-gray-400">
            {data.bookingConversion.confirmed} confirmed of {data.bookingConversion.total} requests
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-2 font-medium text-navy">AI Usage</h2>
          <p className="text-2xl font-semibold text-navy">
            {data.aiUsage.creditsUsed}
            {data.aiUsage.creditsLimit !== null && <span className="text-base text-gray-400"> / {data.aiUsage.creditsLimit}</span>}
          </p>
          <p className="text-xs text-gray-400">{data.aiUsage.plan} plan{data.aiUsage.creditsLimit === null && " (unlimited)"}</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-navy">{value}</div>
    </div>
  );
}
