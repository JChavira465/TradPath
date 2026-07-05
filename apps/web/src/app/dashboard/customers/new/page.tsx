"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateCustomer } from "@/hooks/use-customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NewCustomerPage() {
  const router = useRouter();
  const createCustomer = useCreateCustomer();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [propertyType, setPropertyType] = useState("RESIDENTIAL");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const customer = await createCustomer.mutateAsync({
        firstName,
        lastName,
        company: company || undefined,
        email: email || undefined,
        phone: phone || undefined,
        serviceAddress: serviceAddress || undefined,
        city: city || undefined,
        state: state || undefined,
        zip: zip || undefined,
        propertyType,
      });
      router.push(`/dashboard/customers/${customer.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Could not create customer.");
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Customer</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-white p-6">
        <div className="grid grid-cols-2 gap-4">
          <Input required placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input required placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <Input placeholder="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Input
          placeholder="Service address"
          value={serviceAddress}
          onChange={(e) => setServiceAddress(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-4">
          <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <Input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
          <Input placeholder="Zip" value={zip} onChange={(e) => setZip(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Property type</label>
          <select
            className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
          >
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={createCustomer.isPending}>
            {createCustomer.isPending ? "Creating…" : "Create Customer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
