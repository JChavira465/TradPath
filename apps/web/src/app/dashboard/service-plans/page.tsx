"use client";

import Link from "next/link";
import { useServicePlanDashboard, useServicePlans } from "@/hooks/use-service-plans";
import { InvoicingStatusBadge } from "@/components/invoicing/status-badge";
import { Button } from "@/components/ui/button";

function DashCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs uppercase text-gray-400">{label}</div>
      <div className="text-lg font-semibold text-navy">{value}</div>
    </div>
  );
}

export default function ServicePlansPage() {
  const { data: plans, isLoading } = useServicePlans();
  const { data: dashboard } = useServicePlanDashboard();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Service Plans</h1>
        <Link href="/dashboard/service-plans/new">
          <Button>New Service Plan</Button>
        </Link>
      </div>

      {dashboard && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <DashCard label="MRR" value={`$${dashboard.mrr.toFixed(2)}`} />
          <DashCard label="ARR" value={`$${dashboard.arr.toFixed(2)}`} />
          <DashCard label="Active Plans" value={String(dashboard.activeCount)} />
          <DashCard label="Churned (30d)" value={String(dashboard.churnedLast30Days)} />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {plans?.map((plan) => (
                <tr key={plan.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/service-plans/${plan.id}`} className="font-medium text-navy">
                      {plan.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {plan.customer ? `${plan.customer.firstName} ${plan.customer.lastName}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    ${plan.price}/{plan.billingCycle === "MONTHLY" ? "mo" : "yr"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{plan.serviceFrequency}</td>
                  <td className="px-4 py-3">
                    <InvoicingStatusBadge status={plan.status} />
                  </td>
                </tr>
              ))}
              {plans?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No service plans yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
