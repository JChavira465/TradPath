"use client";

import { useParams, useRouter } from "next/navigation";
import { useConvertEstimateToJob, useEstimate, useSendEstimate } from "@/hooks/use-estimates";
import { InvoicingStatusBadge } from "@/components/invoicing/status-badge";
import { Button } from "@/components/ui/button";

export default function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: estimate, isLoading } = useEstimate(id);
  const sendEstimate = useSendEstimate(id);
  const convertToJob = useConvertEstimateToJob(id);

  if (isLoading || !estimate) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  const onConvert = async () => {
    const job = await convertToJob.mutateAsync();
    router.push(`/dashboard/jobs/${(job as any).id}`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-400">#{estimate.estimateNumber}</div>
          <h1 className="text-2xl font-semibold text-navy">{estimate.title}</h1>
          <div className="mt-2">
            <InvoicingStatusBadge status={estimate.status} />
          </div>
        </div>
        <div className="flex gap-2">
          {(estimate.status === "DRAFT" || estimate.status === "SENT") && (
            <Button variant="outline" onClick={() => sendEstimate.mutate()} disabled={sendEstimate.isPending}>
              {estimate.sentAt ? "Resend" : "Send"}
            </Button>
          )}
          {!estimate.jobId && estimate.status !== "DECLINED" && estimate.status !== "EXPIRED" && (
            <Button onClick={onConvert} disabled={convertToJob.isPending}>
              Convert to Job
            </Button>
          )}
        </div>
      </div>

      {estimate.customer && (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-600">
          {estimate.customer.firstName} {estimate.customer.lastName}
        </div>
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
            {estimate.lineItems.map((li, i) => (
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
            <span>${estimate.subtotal}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Tax</span>
            <span>${estimate.taxAmount}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-navy">
            <span>Total</span>
            <span>${estimate.total}</span>
          </div>
        </div>
      </div>

      {estimate.notes && (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-600">
          <div className="mb-1 font-medium text-navy">Notes</div>
          {estimate.notes}
        </div>
      )}
    </div>
  );
}
