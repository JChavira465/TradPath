"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { BookingPage, PublicPlanTemplate, ServiceOffering } from "@tradpath/types";
import { publicApiClient } from "@/lib/public-api-client";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { StripePaymentForm } from "@/components/stripe-payment-form";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

type Step =
  | "mode"
  | "service"
  | "time"
  | "details"
  | "done"
  | "plan-select"
  | "plan-details"
  | "plan-payment"
  | "plan-done";

export default function PublicBookingPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: page, isLoading: pageLoading } = useQuery({
    queryKey: ["book", slug, "page"],
    queryFn: async () => (await publicApiClient.get<BookingPage>(`/book/${slug}`)).data,
    retry: false,
  });

  const { data: services } = useQuery({
    queryKey: ["book", slug, "services"],
    queryFn: async () => (await publicApiClient.get<ServiceOffering[]>(`/book/${slug}/services`)).data,
    enabled: !!page,
  });

  const { data: plans } = useQuery({
    queryKey: ["book", slug, "plans"],
    queryFn: async () => (await publicApiClient.get<PublicPlanTemplate[]>(`/book/${slug}/plans`)).data,
    enabled: !!page,
  });

  const [serviceOfferingId, setServiceOfferingId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [timeSlot, setTimeSlot] = useState("");
  const [step, setStep] = useState<Step>("mode");
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPlan, setSelectedPlan] = useState<PublicPlanTemplate | null>(null);
  const [subscribeClientSecret, setSubscribeClientSecret] = useState<string | null>(null);
  const [subscribeForm, setSubscribeForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });

  const { data: availability } = useQuery({
    queryKey: ["book", slug, "availability", date],
    queryFn: async () => (await publicApiClient.get(`/book/${slug}/availability`, { params: { date } })).data,
    enabled: step === "time",
  });

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    serviceAddress: "",
    city: "",
    state: "",
    zip: "",
    notes: "",
  });

  if (pageLoading) {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-center text-gray-500">Loading…</div>;
  }
  if (!page) {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-center text-gray-500">This booking page isn&apos;t available.</div>;
  }

  const brandColor = page.bookingPageColor ?? "#1B2A4A";
  const hasPlans = (plans?.length ?? 0) > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await publicApiClient.post(`/book/${slug}/request`, {
        ...form,
        serviceOfferingId: serviceOfferingId || undefined,
        requestedDate: date,
        requestedTimeSlot: timeSlot || undefined,
        turnstileToken,
      });
      setConfirmationCode(res.data.confirmationCode);
      setStep("done");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Could not submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const onSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await publicApiClient.post(`/book/${slug}/subscribe`, {
        ...subscribeForm,
        planTemplateId: selectedPlan.id,
        turnstileToken,
      });
      if (res.data.clientSecret) {
        setSubscribeClientSecret(res.data.clientSecret);
        setStep("plan-payment");
      } else {
        setStep("plan-done");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Could not start your subscription. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold" style={{ color: brandColor }}>
          {page.bookingPageTitle ?? page.name}
        </h1>
        {page.bookingPageDescription && <p className="mt-2 text-sm text-gray-500">{page.bookingPageDescription}</p>}
      </div>

      {step === "mode" && (
        <div className="space-y-3">
          <button
            onClick={() => setStep("service")}
            className="block w-full rounded-lg border bg-white p-4 text-left hover:border-brand"
          >
            <div className="font-medium text-navy">Book a service</div>
            <div className="text-sm text-gray-500">Schedule a one-time visit</div>
          </button>
          {hasPlans && (
            <button
              onClick={() => setStep("plan-select")}
              className="block w-full rounded-lg border bg-white p-4 text-left hover:border-brand"
            >
              <div className="font-medium text-navy">Subscribe to a plan</div>
              <div className="text-sm text-gray-500">Recurring maintenance, billed automatically</div>
            </button>
          )}
        </div>
      )}

      {step === "service" && (
        <div className="space-y-3">
          <h2 className="font-medium text-gray-700">Choose a service</h2>
          {services?.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setServiceOfferingId(s.id);
                setStep("time");
              }}
              className="block w-full rounded-lg border bg-white p-4 text-left hover:border-brand"
            >
              <div className="font-medium text-navy">{s.name}</div>
              {s.description && <div className="text-sm text-gray-500">{s.description}</div>}
              {s.price && <div className="mt-1 text-sm text-gray-400">${s.price}</div>}
            </button>
          ))}
          <button
            onClick={() => setStep("time")}
            className="text-sm text-gray-400 underline hover:text-gray-600"
          >
            Skip — I&apos;m not sure yet
          </button>
        </div>
      )}

      {step === "time" && (
        <div className="space-y-4">
          <h2 className="font-medium text-gray-700">Choose a date &amp; time</h2>
          <input
            type="date"
            min={todayStr()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-md border border-gray-300 px-3 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {availability?.slots?.length ? (
              availability.slots.map((slot: string) => (
                <button
                  key={slot}
                  onClick={() => setTimeSlot(slot)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${timeSlot === slot ? "border-brand bg-brand text-white" : "bg-white"}`}
                >
                  {slot}
                </button>
              ))
            ) : (
              <p className="text-sm text-gray-400">No open slots this day — try another date.</p>
            )}
          </div>
          <button
            disabled={!timeSlot}
            onClick={() => setStep("details")}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {step === "details" && (
        <form onSubmit={onSubmit} className="space-y-3">
          <h2 className="font-medium text-gray-700">Your details</h2>
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="First name" className="h-10 rounded-md border border-gray-300 px-3 text-sm" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <input required placeholder="Last name" className="h-10 rounded-md border border-gray-300 px-3 text-sm" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <input required type="email" placeholder="Email" className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input required placeholder="Phone" className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input required placeholder="Service address" className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={form.serviceAddress} onChange={(e) => setForm({ ...form, serviceAddress: e.target.value })} />
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="City" className="h-10 rounded-md border border-gray-300 px-3 text-sm" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input placeholder="State" className="h-10 rounded-md border border-gray-300 px-3 text-sm" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            <input placeholder="Zip" className="h-10 rounded-md border border-gray-300 px-3 text-sm" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
          </div>
          <textarea
            placeholder="Anything else we should know?"
            maxLength={1000}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <TurnstileWidget onToken={setTurnstileToken} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: brandColor }}
          >
            {submitting ? "Submitting…" : "Request Booking"}
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="rounded-lg border bg-green-50 p-6 text-center">
          <p className="font-medium text-green-700">Thanks! Your request has been sent.</p>
          <p className="mt-2 text-sm text-gray-600">Confirmation code: {confirmationCode}</p>
        </div>
      )}

      {step === "plan-select" && (
        <div className="space-y-3">
          <h2 className="font-medium text-gray-700">Choose a plan</h2>
          {plans?.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedPlan(p);
                setStep("plan-details");
              }}
              className="block w-full rounded-lg border bg-white p-4 text-left hover:border-brand"
            >
              <div className="font-medium text-navy">{p.publicName}</div>
              {p.publicDescription && <div className="text-sm text-gray-500">{p.publicDescription}</div>}
              <div className="mt-1 text-sm text-gray-400">
                ${p.price}/{p.billingCycle === "MONTHLY" ? "mo" : "yr"}
              </div>
            </button>
          ))}
        </div>
      )}

      {step === "plan-details" && selectedPlan && (
        <form onSubmit={onSubscribe} className="space-y-3">
          <h2 className="font-medium text-gray-700">Subscribe to {selectedPlan.publicName}</h2>
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="First name" className="h-10 rounded-md border border-gray-300 px-3 text-sm" value={subscribeForm.firstName} onChange={(e) => setSubscribeForm({ ...subscribeForm, firstName: e.target.value })} />
            <input required placeholder="Last name" className="h-10 rounded-md border border-gray-300 px-3 text-sm" value={subscribeForm.lastName} onChange={(e) => setSubscribeForm({ ...subscribeForm, lastName: e.target.value })} />
          </div>
          <input required type="email" placeholder="Email" className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={subscribeForm.email} onChange={(e) => setSubscribeForm({ ...subscribeForm, email: e.target.value })} />
          <input required placeholder="Phone" className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={subscribeForm.phone} onChange={(e) => setSubscribeForm({ ...subscribeForm, phone: e.target.value })} />
          <TurnstileWidget onToken={setTurnstileToken} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: brandColor }}
          >
            {submitting ? "Starting…" : "Continue"}
          </button>
        </form>
      )}

      {step === "plan-payment" && (
        <div>
          <h2 className="mb-3 font-medium text-gray-700">Add a payment method</h2>
          {stripePromise && subscribeClientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret: subscribeClientSecret, appearance: { variables: { colorPrimary: brandColor } } }}>
              <StripePaymentForm onSuccess={() => setStep("plan-done")} submitLabel="Start subscription" />
            </Elements>
          ) : (
            <p className="text-sm text-gray-400">Preparing payment…</p>
          )}
        </div>
      )}

      {step === "plan-done" && (
        <div className="rounded-lg border bg-green-50 p-6 text-center">
          <p className="font-medium text-green-700">You&apos;re all set!</p>
          <p className="mt-2 text-sm text-gray-600">Your subscription is active. We&apos;ll be in touch to schedule your first visit.</p>
        </div>
      )}
    </div>
  );
}
