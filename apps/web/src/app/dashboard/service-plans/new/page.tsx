"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomers } from "@/hooks/use-customers";
import { useCreateServicePlan } from "@/hooks/use-service-plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NewServicePlanPage() {
  const router = useRouter();
  const { data: customers } = useCustomers();
  const createPlan = useCreateServicePlan();

  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [billingCycle, setBillingCycle] = useState("MONTHLY");
  const [serviceFrequency, setServiceFrequency] = useState("QUARTERLY");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const plan = await createPlan.mutateAsync({
        customerId,
        name,
        price: Number(price),
        billingCycle,
        serviceFrequency,
      });
      router.push(`/dashboard/service-plans/${plan.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Could not create service plan.");
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Service Plan</h1>
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

        <Input required placeholder="Plan name (e.g. HVAC Maintenance Plan)" value={name} onChange={(e) => setName(e.target.value)} />

        <div className="grid grid-cols-3 gap-4">
          <Input required type="number" step="0.01" min="0" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
          <select
            className="h-10 rounded-md border border-gray-300 px-3 text-sm"
            value={billingCycle}
            onChange={(e) => setBillingCycle(e.target.value)}
          >
            <option value="MONTHLY">Monthly billing</option>
            <option value="ANNUAL">Annual billing</option>
          </select>
          <select
            className="h-10 rounded-md border border-gray-300 px-3 text-sm"
            value={serviceFrequency}
            onChange={(e) => setServiceFrequency(e.target.value)}
          >
            <option value="WEEKLY">Weekly service</option>
            <option value="BIWEEKLY">Biweekly service</option>
            <option value="MONTHLY">Monthly service</option>
            <option value="QUARTERLY">Quarterly service</option>
            <option value="BIANNUAL">Biannual service</option>
            <option value="ANNUAL">Annual service</option>
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={createPlan.isPending}>
            {createPlan.isPending ? "Creating…" : "Create Plan"}
          </Button>
        </div>
      </form>
    </div>
  );
}
