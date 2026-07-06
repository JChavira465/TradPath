"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useInvoice, useRecordPayment, useSendInvoice } from "@/hooks/use-invoices";
import { InvoicingStatusBadge } from "@/components/invoicing/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading } = useInvoice(id);
  const sendInvoice = useSendInvoice(id);
  const recordPayment = useRecordPayment(id);

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !invoice) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  const payUrl = typeof window !== "undefined" ? `${window.location.origin}/pay/${invoice.id}` : "";

  const onRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await recordPayment.mutateAsync({ amount: Number(amount), method, reference: reference || undefined });
      setShowPaymentForm(false);
      setAmount("");
      setReference("");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Could not record payment.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-400">#{invoice.invoiceNumber}</div>
          <h1 className="text-2xl font-semibold text-navy">
            {invoice.customer ? `${invoice.customer.firstName} ${invoice.customer.lastName}` : "Invoice"}
          </h1>
          <div className="mt-2">
            <InvoicingStatusBadge status={invoice.status} />
          </div>
        </div>
        <div className="flex gap-2">
          {invoice.status !== "PAID" && invoice.status !== "VOID" && (
            <>
              <Button variant="outline" onClick={() => sendInvoice.mutate()} disabled={sendInvoice.isPending}>
                {invoice.sentAt ? "Resend" : "Send"}
              </Button>
              <Button onClick={() => setShowPaymentForm((v) => !v)}>Record Payment</Button>
            </>
          )}
        </div>
      </div>

      {invoice.sentAt && payUrl && (
        <div className="rounded-lg border bg-blue-50 p-3 text-xs text-gray-600">
          Customer pay link: <a href={payUrl} className="text-brand underline">{payUrl}</a>
        </div>
      )}

      {showPaymentForm && (
        <form onSubmit={onRecordPayment} className="space-y-3 rounded-lg border bg-white p-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Amount"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <select
              className="h-10 rounded-md border border-gray-300 px-3 text-sm"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="CASH">Cash</option>
              <option value="CHECK">Check</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <Input placeholder="Reference (check #, etc.)" value={reference} onChange={(e) => setReference(e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowPaymentForm(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={recordPayment.isPending}>
              Record
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-lg border bg-white p-6">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-400">
            <tr>
              <th className="pb-2">Description</th>
              <th className="pb-2 text-right">Qty</th>
              <th className="pb-2 text-right">Unit Price</th>
              <th className="pb-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoice.lineItems.map((li, i) => (
              <tr key={i}>
                <td className="py-2">{li.description}</td>
                <td className="py-2 text-right">{li.quantity}</td>
                <td className="py-2 text-right">${li.unitPrice.toFixed(2)}</td>
                <td className="py-2 text-right">${(li.quantity * li.unitPrice).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>${invoice.subtotal}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Tax</span>
            <span>${invoice.taxAmount}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-navy">
            <span>Total</span>
            <span>${invoice.total}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Paid</span>
            <span>${invoice.amountPaid}</span>
          </div>
          <div className="flex justify-between font-medium text-red-600">
            <span>Amount Due</span>
            <span>${invoice.amountDue}</span>
          </div>
        </div>
      </div>

      {invoice.includePhotos && invoice.photoUrls.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-2 font-medium text-navy">Before / After Photos</div>
          <div className="grid grid-cols-3 gap-2">
            {invoice.photoUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt={`Job photo ${i + 1}`} className="aspect-square rounded-md object-cover" />
            ))}
          </div>
        </div>
      )}

      {invoice.payments && invoice.payments.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-2 font-medium text-navy">Payment History</div>
          <div className="space-y-1 text-sm text-gray-600">
            {invoice.payments.map((p) => (
              <div key={p.id} className="flex justify-between">
                <span>
                  {p.method} {p.reference && `(${p.reference})`}
                </span>
                <span>${p.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
