"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LineItem } from "@tradpath/types";
import { useCustomers } from "@/hooks/use-customers";
import { useCreateInvoice } from "@/hooks/use-invoices";
import { useJobPhotos } from "@/hooks/use-jobs";
import { LineItemsEditor, computeLocalTotals } from "@/components/invoicing/line-items-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") ?? undefined;
  const { data: customers } = useCustomers();
  const createInvoice = useCreateInvoice();
  const { data: jobPhotos } = useJobPhotos(jobId ?? "");

  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [includePhotos, setIncludePhotos] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0, taxable: true }]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const paramCustomerId = searchParams.get("customerId");
    if (paramCustomerId) setCustomerId(paramCustomerId);
  }, [searchParams]);

  const visiblePhotoCount = jobPhotos?.filter((p) => p.isCustomerVisible && (p.type === "BEFORE" || p.type === "AFTER")).length ?? 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const totals = computeLocalTotals(lineItems, taxRate, discountAmount);
    try {
      const invoice = await createInvoice.mutateAsync({
        customerId,
        jobId,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        lineItems,
        taxRate,
        discountAmount,
        subtotal: totals.subtotal,
        total: totals.total,
        includePhotos: jobId ? includePhotos : undefined,
      });
      router.push(`/dashboard/invoices/${invoice.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Could not create invoice.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Invoice</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Customer</label>
          <select
            required
            className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Select a customer…</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Due date</label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tax rate (%)</label>
            <Input type="number" step="0.01" min="0" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Discount ($)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(Number(e.target.value))}
            />
          </div>
        </div>

        <LineItemsEditor lineItems={lineItems} onChange={setLineItems} taxRate={taxRate} discountAmount={discountAmount} />

        {jobId && (
          <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <input type="checkbox" checked={includePhotos} onChange={(e) => setIncludePhotos(e.target.checked)} />
            Include before/after photos from this job on the invoice
            {visiblePhotoCount > 0 && ` (${visiblePhotoCount} available)`}
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={createInvoice.isPending}>
            {createInvoice.isPending ? "Creating…" : "Create Invoice"}
          </Button>
        </div>
      </form>
    </div>
  );
}
