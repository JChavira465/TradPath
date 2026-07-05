"use client";

import Link from "next/link";
import { useEstimates } from "@/hooks/use-estimates";
import { InvoicingStatusBadge } from "@/components/invoicing/status-badge";
import { Button } from "@/components/ui/button";

export default function EstimatesPage() {
  const { data: estimates, isLoading } = useEstimates();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Estimates</h1>
        <Link href="/dashboard/estimates/new">
          <Button>New Estimate</Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Estimate #</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {estimates?.map((est) => (
                <tr key={est.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/estimates/${est.id}`} className="font-medium text-navy">
                      #{est.estimateNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{est.title}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {est.customer ? `${est.customer.firstName} ${est.customer.lastName}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">${est.total}</td>
                  <td className="px-4 py-3">
                    <InvoicingStatusBadge status={est.status} />
                  </td>
                </tr>
              ))}
              {estimates?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No estimates yet.
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
