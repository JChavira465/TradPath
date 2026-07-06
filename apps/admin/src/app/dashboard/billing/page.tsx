"use client";

import { useState } from "react";
import {
  useCoupons,
  useCreateCoupon,
  useCreateRefund,
  useFailedPayments,
  usePlanMrr,
  useSubscriptions,
  useTrials,
} from "@/hooks/use-admin-billing";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <h2 className="mb-3 font-medium text-white">{title}</h2>
      {children}
    </div>
  );
}

export default function BillingPage() {
  const { data: planMrr } = usePlanMrr();
  const { data: subscriptions } = useSubscriptions();
  const { data: trials } = useTrials();
  const { data: failedPayments } = useFailedPayments();
  const { data: coupons } = useCoupons();
  const createCoupon = useCreateCoupon();
  const createRefund = useCreateRefund();

  const [couponName, setCouponName] = useState("");
  const [couponValue, setCouponValue] = useState(10);
  const [refundPaymentIntent, setRefundPaymentIntent] = useState("");
  const [refundMessage, setRefundMessage] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Billing</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/50">Platform MRR</div>
          <div className="mt-1 text-xl font-semibold text-white">${planMrr?.totalMrr.toFixed(2) ?? "—"}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/50">Platform ARR</div>
          <div className="mt-1 text-xl font-semibold text-white">${planMrr?.totalArr.toFixed(2) ?? "—"}</div>
        </div>
      </div>

      <Section title="Plan MRR breakdown">
        <div className="space-y-1 text-sm text-white/70">
          {planMrr?.byPlan.map((p) => (
            <div key={p.plan} className="flex justify-between">
              <span>{p.plan} ({p.orgCount} orgs)</span>
              <span>${p.mrr.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Subscriptions">
        <div className="space-y-1 text-sm text-white/70">
          {subscriptions?.organizations.map((o) => (
            <div key={o.id} className="flex justify-between border-b border-white/5 py-1">
              <span>{o.name}</span>
              <span>
                {o.subscriptionPlan} / {o.subscriptionStatus}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Trials ending soon (14d)">
        <div className="space-y-1 text-sm text-white/70">
          {trials?.map((t) => (
            <div key={t.id} className="flex justify-between">
              <span>{t.name}</span>
              <span>{new Date(t.trialEndsAt).toLocaleDateString()}</span>
            </div>
          ))}
          {trials?.length === 0 && <p className="text-white/40">No trials ending soon.</p>}
        </div>
      </Section>

      <Section title="Failed payments">
        <div className="space-y-1 text-sm text-white/70">
          {failedPayments?.payments.map((p) => (
            <div key={p.id} className="flex justify-between border-b border-white/5 py-1">
              <span>{p.organization?.name ?? p.customerEmail ?? "Unknown"}</span>
              <span>
                ${p.amount.toFixed(2)} — {new Date(p.failedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
          {failedPayments?.payments.length === 0 && <p className="text-white/40">No failed payments.</p>}
        </div>
      </Section>

      <Section title="Refund a payment">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={refundPaymentIntent}
            onChange={(e) => setRefundPaymentIntent(e.target.value)}
            placeholder="Stripe payment intent ID"
            className="w-64 rounded-md border border-white/10 bg-adminbg px-2 py-1 text-sm text-white"
          />
          <button
            disabled={!refundPaymentIntent}
            onClick={async () => {
              setRefundMessage(null);
              try {
                await createRefund.mutateAsync({ stripePaymentIntentId: refundPaymentIntent });
                setRefundMessage("Refund created.");
              } catch (err: any) {
                setRefundMessage(err?.response?.data?.message ?? "Refund failed.");
              }
            }}
            className="rounded-md bg-red-600/20 px-3 py-1.5 text-sm text-red-300 hover:bg-red-600/30 disabled:opacity-40"
          >
            Refund
          </button>
        </div>
        {refundMessage && <p className="mt-2 text-xs text-white/60">{refundMessage}</p>}
      </Section>

      <Section title="Coupons">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={couponName}
            onChange={(e) => setCouponName(e.target.value)}
            placeholder="Coupon name"
            className="rounded-md border border-white/10 bg-adminbg px-2 py-1 text-sm text-white"
          />
          <input
            type="number"
            value={couponValue}
            onChange={(e) => setCouponValue(Number(e.target.value))}
            className="w-20 rounded-md border border-white/10 bg-adminbg px-2 py-1 text-sm text-white"
          />
          <span className="text-sm text-white/50">% off</span>
          <button
            disabled={!couponName}
            onClick={() => createCoupon.mutate({ name: couponName, type: "percent", value: couponValue })}
            className="rounded-md bg-purple/20 px-3 py-1.5 text-sm text-purple-200 hover:bg-purple/30 disabled:opacity-40"
          >
            Create coupon
          </button>
        </div>
        <div className="space-y-1 text-sm text-white/70">
          {coupons?.map((c) => (
            <div key={c.id} className="flex justify-between">
              <span>{c.name ?? c.id}</span>
              <span>{c.percentOff ? `${c.percentOff}% off` : c.amountOff ? `$${c.amountOff} off` : ""}</span>
            </div>
          ))}
          {coupons?.length === 0 && <p className="text-white/40">No coupons yet.</p>}
        </div>
      </Section>
    </div>
  );
}
