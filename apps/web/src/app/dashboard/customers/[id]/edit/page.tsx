"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCustomer, useUpdateCustomer } from "@/hooks/use-customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: customer, isLoading } = useCustomer(id);
  const updateCustomer = useUpdateCustomer(id);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setFirstName(customer.firstName);
      setLastName(customer.lastName);
      setCompany(customer.company ?? "");
      setEmail(customer.email ?? "");
      setPhone(customer.phone ?? "");
      setServiceAddress(customer.serviceAddress ?? "");
      setNotes(customer.notes ?? "");
    }
  }, [customer]);

  if (isLoading || !customer) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await updateCustomer.mutateAsync({
        firstName,
        lastName,
        company: company || undefined,
        email: email || undefined,
        phone: phone || undefined,
        serviceAddress: serviceAddress || undefined,
        notes: notes || undefined,
      });
      router.push(`/dashboard/customers/${id}`);
    } catch {
      setError("Could not save changes.");
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold text-navy">Edit Customer</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-white p-6">
        <div className="grid grid-cols-2 gap-4">
          <Input required placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input required placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <Input placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Input
          placeholder="Service address"
          value={serviceAddress}
          onChange={(e) => setServiceAddress(e.target.value)}
        />
        <textarea
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          rows={3}
          placeholder="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateCustomer.isPending}>
            {updateCustomer.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
