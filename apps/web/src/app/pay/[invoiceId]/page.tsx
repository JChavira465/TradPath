"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { PublicInvoice } from "@tradpath/types";
import { publicApiClient } from "@/lib/public-api-client";
import { StripePaymentForm } from "@/components/stripe-payment-form";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

export default function PayPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["public-invoice", invoiceId],
    queryFn: async () => (await publicApiClient.get<PublicInvoice>(`/public/invoices/${invoiceId}`)).data,
  });

  useEffect(() => {
    if (!invoice || invoice.status === "PAID" || invoice.status === "VOID" || clientSecret) return;
    publicApiClient
      .post(`/public/invoices/${invoiceId}/payment-intent`)
      .then((res) => setClientSecret(res.data.clientSecret))
      .catch(() => setError("Could not start payment. Please try again shortly."));
  }, [invoice, invoiceId, clientSecret]);

  if (isLoading) {
    return <div className="mx-auto max-w-md px-6 py-16 text-center text-gray-500">Loading…</div>;
  }

  if (!invoice) {
    return <div className="mx-auto max-w-md px-6 py-16 text-center text-gray-500">Invoice not found.</div>;
  }

  const brandColor = invoice.organization.bookingPageColor ?? "#2563EB";

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold" style={{ color: brandColor }}>
          {invoice.organization.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">Invoice #{invoice.invoiceNumber}</p>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex justify-between text-sm">
          <span className="text-gray-500">Amount due</span>
          <span className="text-lg font-semibold text-navy">${invoice.amountDue}</span>
        </div>

        {invoice.status === "PAID" || paid ? (
          <p className="rounded-md bg-green-50 p-4 text-center text-sm text-green-700">
            This invoice has been paid. Thank you!
          </p>
        ) : invoice.status === "VOID" ? (
          <p className="rounded-md bg-gray-50 p-4 text-center text-sm text-gray-500">This invoice has been voided.</p>
        ) : !stripePromise ? (
          <p className="text-sm text-gray-400">Online payment isn&apos;t configured for this business yet.</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { variables: { colorPrimary: brandColor } } }}>
            <StripePaymentForm onSuccess={() => setPaid(true)} />
          </Elements>
        ) : (
          <p className="text-sm text-gray-400">Preparing payment…</p>
        )}
      </div>
    </div>
  );
}
