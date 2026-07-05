"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LineItem } from "@tradpath/types";
import { useCustomers } from "@/hooks/use-customers";
import { useCreateEstimate } from "@/hooks/use-estimates";
import { LineItemsEditor, computeLocalTotals } from "@/components/invoicing/line-items-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NewEstimatePage() {
  const router = useRouter();
  const { data: customers } = useCustomers();
  const createEstimate = useCreateEstimate();

  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0, taxable: true }]);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const totals = computeLocalTotals(lineItems, taxRate, discountAmount);
    try {
      const estimate = await createEstimate.mutateAsync({
        customerId,
        title,
        lineItems,
        taxRate,
        discountAmount,
        subtotal: totals.subtotal,
        total: totals.total,
      });
      router.push(`/dashboard/estimates/${estimate.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Could not create estimate.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Estimate</h1>
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

        <Input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />

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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={createEstimate.isPending}>
            {createEstimate.isPending ? "Creating…" : "Create Estimate"}
          </Button>
        </div>
      </form>
    </div>
  );
}
