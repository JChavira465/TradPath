"use client";

import Link from "next/link";
import { useDashboardSummary } from "@/hooks/use-dashboard";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { OnboardingChecklistWidget } from "@/components/onboarding/onboarding-checklist";
import { Button } from "@/components/ui/button";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-navy">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

const ACTIVITY_ICON: Record<string, string> = {
  payment: "💵",
  invoice_sent: "📄",
  job_completed: "✅",
  booking_request: "📅",
};

export default function DashboardPage() {
  const { data, isLoading } = useDashboardSummary();

  if (isLoading || !data) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  const changePercent = data.revenueMoM.changePercent;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Dashboard</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/jobs/new">
            <Button variant="outline">New Job</Button>
          </Link>
          <Link href="/dashboard/invoices/new">
            <Button variant="outline">New Invoice</Button>
          </Link>
          <Link href="/dashboard/customers/new">
            <Button variant="outline">New Customer</Button>
          </Link>
          <Link href="/dashboard/time-tracking">
            <Button>Clock In</Button>
          </Link>
        </div>
      </div>

      <OnboardingChecklistWidget />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Today's Jobs" value={String(data.todayJobs.length)} />
        <StatCard label="Pending Bookings" value={String(data.pendingBookingsCount)} />
        <StatCard
          label="AR Outstanding"
          value={`$${data.arSummary.totalOutstanding.toFixed(2)}`}
          sub={`${data.arSummary.invoiceCount} invoices`}
        />
        <StatCard label="Clocked In" value={String(data.clockedInCount)} />
        <StatCard label="Unread Messages" value={String(data.unreadMessagesCount)} />
        <StatCard label="Plan MRR" value={`$${data.planMrr.mrr.toFixed(2)}`} sub={`${data.planMrr.activeCount} active plans`} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-gray-500">Revenue this month</div>
          <div className="mt-1 text-2xl font-semibold text-navy">${data.revenueMoM.thisMonth.toFixed(2)}</div>
          <div className="mt-1 text-xs text-gray-400">
            vs ${data.revenueMoM.lastMonth.toFixed(2)} last month
            {changePercent !== null && (
              <span className={changePercent >= 0 ? "ml-2 text-green-600" : "ml-2 text-red-600"}>
                {changePercent >= 0 ? "▲" : "▼"} {Math.abs(changePercent).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-gray-500">Annual recurring revenue</div>
          <div className="mt-1 text-2xl font-semibold text-navy">${data.planMrr.arr.toFixed(2)}</div>
          <div className="mt-1 text-xs text-gray-400">Based on {data.planMrr.activeCount} active service plans</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 lg:col-span-1">
          <h2 className="mb-3 font-medium text-navy">Today's Jobs</h2>
          <div className="space-y-2">
            {data.todayJobs.map((job) => (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}`}
                className="block rounded-md border p-2 text-sm hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800">#{job.jobNumber}</span>
                  <JobStatusBadge status={job.status} />
                </div>
                <div className="text-gray-500">{job.title}</div>
                {job.customer && (
                  <div className="text-xs text-gray-400">
                    {job.customer.firstName} {job.customer.lastName}
                  </div>
                )}
              </Link>
            ))}
            {data.todayJobs.length === 0 && <p className="text-sm text-gray-400">Nothing scheduled today.</p>}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 lg:col-span-1">
          <h2 className="mb-3 font-medium text-navy">Next 7 Days</h2>
          <div className="space-y-2">
            {data.weekJobs.map((job) => (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}`}
                className="block rounded-md border p-2 text-sm hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800">#{job.jobNumber}</span>
                  <span className="text-xs text-gray-400">
                    {job.scheduledStart
                      ? new Date(job.scheduledStart).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : ""}
                  </span>
                </div>
                <div className="text-gray-500">{job.title}</div>
              </Link>
            ))}
            {data.weekJobs.length === 0 && <p className="text-sm text-gray-400">No jobs scheduled this week.</p>}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 lg:col-span-1">
          <h2 className="mb-3 font-medium text-navy">Renewals Due Soon</h2>
          <div className="space-y-2">
            {data.renewalsDueSoon.map((plan) => (
              <Link
                key={plan.id}
                href={`/dashboard/service-plans/${plan.id}`}
                className="block rounded-md border p-2 text-sm hover:bg-gray-50"
              >
                <div className="font-medium text-gray-800">{plan.name}</div>
                {plan.customer && (
                  <div className="text-xs text-gray-400">
                    {plan.customer.firstName} {plan.customer.lastName}
                  </div>
                )}
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{plan.nextBillingDate ? new Date(plan.nextBillingDate).toLocaleDateString() : "—"}</span>
                  <span>${plan.price}</span>
                </div>
              </Link>
            ))}
            {data.renewalsDueSoon.length === 0 && <p className="text-sm text-gray-400">No renewals in the next 14 days.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-medium text-navy">Activity Feed</h2>
        <div className="space-y-2">
          {data.activity.map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span>{ACTIVITY_ICON[item.type] ?? "•"}</span>
              <div className="flex-1">
                <div className="text-gray-700">{item.description}</div>
                <div className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleString()}</div>
              </div>
            </div>
          ))}
          {data.activity.length === 0 && <p className="text-sm text-gray-400">No recent activity.</p>}
        </div>
      </div>
    </div>
  );
}
