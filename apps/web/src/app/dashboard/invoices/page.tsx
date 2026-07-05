"use client";

import Link from "next/link";
import { useArSummary, useInvoices } from "@/hooks/use-invoices";
import { InvoicingStatusBadge } from "@/components/invoicing/status-badge";
import { Button } from "@/components/ui/button";

function ArCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs uppercase text-gray-400">{label}</div>
      <div className="text-lg font-semibold text-navy">${value.toFixed(2)}</div>
    </div>
  );
}

export default function InvoicesPage() {
  const { data: invoices, isLoading } = useInvoices();
  const { data: ar } = useArSummary();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Invoices</h1>
        <Link href="/dashboard/invoices/new">
          <Button>New Invoice</Button>
        </Link>
      </div>

      {ar && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          <ArCard label="Total AR" value={ar.totalOutstanding} />
          <ArCard label="Current" value={ar.buckets.current} />
          <ArCard label="1-30 days" value={ar.buckets.days1to30} />
          <ArCard label="31-60 days" value={ar.buckets.days31to60} />
          <ArCard label="61+ days" value={ar.buckets.days61to90 + ar.buckets.days90plus} />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices?.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/invoices/${inv.id}`} className="font-medium text-navy">
                      #{inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {inv.customer ? `${inv.customer.firstName} ${inv.customer.lastName}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">${inv.total}</td>
                  <td className="px-4 py-3 text-gray-500">${inv.amountDue}</td>
                  <td className="px-4 py-3">
                    <InvoicingStatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
              {invoices?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No invoices yet.
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
