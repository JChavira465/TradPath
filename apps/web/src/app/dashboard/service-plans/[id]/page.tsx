"use client";

import { useParams } from "next/navigation";
import { useServicePlan, useServicePlanAction } from "@/hooks/use-service-plans";
import { InvoicingStatusBadge } from "@/components/invoicing/status-badge";
import { Button } from "@/components/ui/button";

export default function ServicePlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: plan, isLoading } = useServicePlan(id);
  const actions = useServicePlanAction(id);

  if (isLoading || !plan) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy">{plan.name}</h1>
          <p className="text-sm text-gray-500">
            {plan.customer ? `${plan.customer.firstName} ${plan.customer.lastName}` : ""}
          </p>
          <div className="mt-2">
            <InvoicingStatusBadge status={plan.status} />
          </div>
        </div>
        <div className="flex gap-2">
          {plan.status === "ACTIVE" && (
            <>
              <Button variant="outline" onClick={() => actions.pause.mutate()} disabled={actions.pause.isPending}>
                Pause
              </Button>
              <Button variant="outline" onClick={() => actions.generateJob.mutate()} disabled={actions.generateJob.isPending}>
                Generate Job Now
              </Button>
              <Button
                variant="destructive"
                onClick={() => actions.cancel.mutate(undefined)}
                disabled={actions.cancel.isPending}
              >
                Cancel
              </Button>
            </>
          )}
          {plan.status === "PAUSED" && (
            <Button onClick={() => actions.resume.mutate()} disabled={actions.resume.isPending}>
              Resume
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs uppercase text-gray-400">Price</div>
          <div className="text-lg font-semibold text-navy">
            ${plan.price}/{plan.billingCycle === "MONTHLY" ? "mo" : "yr"}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs uppercase text-gray-400">Service Frequency</div>
          <div className="text-lg font-semibold text-navy">{plan.serviceFrequency}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs uppercase text-gray-400">Next Service</div>
          <div className="text-sm text-gray-700">
            {plan.nextServiceDate ? new Date(plan.nextServiceDate).toLocaleDateString() : "—"}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs uppercase text-gray-400">Next Billing</div>
          <div className="text-sm text-gray-700">
            {plan.nextBillingDate ? new Date(plan.nextBillingDate).toLocaleDateString() : "—"}
          </div>
        </div>
      </div>

      {plan.serviceDescription && (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-600">
          <div className="mb-1 font-medium text-navy">Service Description</div>
          {plan.serviceDescription}
        </div>
      )}

      {plan.cancelledAt && (
        <div className="rounded-lg border bg-red-50 p-4 text-sm text-red-700">
          Cancelled {new Date(plan.cancelledAt).toLocaleDateString()}
          {plan.cancelReason && ` — ${plan.cancelReason}`}
        </div>
      )}
    </div>
  );
}
