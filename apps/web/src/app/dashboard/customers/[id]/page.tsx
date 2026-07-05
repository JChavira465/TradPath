"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useAddEquipment,
  useCustomer,
  useCustomerEquipment,
  useCustomerEstimates,
  useCustomerInvoices,
  useCustomerJobs,
  useCustomerServicePlans,
  useDeleteCustomer,
  useDeleteEquipment,
} from "@/hooks/use-customers";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tab = "jobs" | "invoices" | "estimates" | "service-plans" | "messages";

function EquipmentCard({ eq, onDelete }: { eq: any; onDelete: () => void }) {
  const warrantyExpired = eq.warrantyExpiry && new Date(eq.warrantyExpiry) < new Date();
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium text-navy">{eq.name}</div>
          <div className="text-xs text-gray-500">
            {[eq.make, eq.model].filter(Boolean).join(" · ") || "No make/model"}
          </div>
        </div>
        <button onClick={onDelete} className="text-xs text-gray-400 hover:text-red-600">
          Remove
        </button>
      </div>
      <div className="mt-2 space-y-1 text-xs text-gray-500">
        {eq.serialNumber && <div>Serial: {eq.serialNumber}</div>}
        {eq.warrantyExpiry && (
          <div className={warrantyExpired ? "text-red-600" : ""}>
            Warranty {warrantyExpired ? "expired" : "until"} {new Date(eq.warrantyExpiry).toLocaleDateString()}
          </div>
        )}
        {eq.nextServiceDate && <div>Next service: {new Date(eq.nextServiceDate).toLocaleDateString()}</div>}
      </div>
    </div>
  );
}

function AddEquipmentForm({ customerId, onDone }: { customerId: string; onDone: () => void }) {
  const addEquipment = useAddEquipment(customerId);
  const [name, setName] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addEquipment.mutateAsync({ name, make: make || undefined, model: model || undefined, serialNumber: serialNumber || undefined });
    onDone();
  };

  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-white p-4">
      <div className="grid grid-cols-2 gap-2">
        <Input required placeholder="Name (e.g. Central AC)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Make" value={make} onChange={(e) => setMake(e.target.value)} />
        <Input placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} />
        <Input placeholder="Serial number" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={addEquipment.isPending}>
          Add
        </Button>
      </div>
    </form>
  );
}

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: customer, isLoading } = useCustomer(id);
  const { data: equipment } = useCustomerEquipment(id);
  const deleteCustomer = useDeleteCustomer();
  const deleteEquipment = useDeleteEquipment(id);

  const [tab, setTab] = useState<Tab>("jobs");
  const [showAddEquipment, setShowAddEquipment] = useState(false);

  const jobsQuery = useCustomerJobs(id);
  const invoicesQuery = useCustomerInvoices(id);
  const estimatesQuery = useCustomerEstimates(id);
  const servicePlansQuery = useCustomerServicePlans(id);

  if (isLoading || !customer) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  const onDelete = async () => {
    if (!confirm(`Delete ${customer.firstName} ${customer.lastName}? This also deletes all their jobs, invoices, estimates, service plans, and equipment. This cannot be undone.`)) {
      return;
    }
    await deleteCustomer.mutateAsync(id);
    router.push("/dashboard/customers");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy">
            {customer.firstName} {customer.lastName}
          </h1>
          {customer.company && <p className="text-sm text-gray-500">{customer.company}</p>}
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/jobs/new?customerId=${id}`}>
            <Button>New Job</Button>
          </Link>
          <Link href={`/dashboard/customers/${id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
          <Button variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs uppercase text-gray-400">Outstanding Balance</div>
          <div className={`text-xl font-semibold ${Number(customer.outstandingBalance) > 0 ? "text-red-600" : "text-navy"}`}>
            ${customer.outstandingBalance}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs uppercase text-gray-400">Contact</div>
          <div className="text-sm text-gray-700">{customer.phone ?? "No phone"}</div>
          <div className="text-sm text-gray-700">{customer.email ?? "No email"}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs uppercase text-gray-400">Address</div>
          <div className="text-sm text-gray-700">
            {customer.serviceAddress ?? "—"}
            {customer.city && `, ${customer.city}`} {customer.state} {customer.zip}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium text-navy">Equipment</h2>
          {!showAddEquipment && (
            <Button variant="outline" onClick={() => setShowAddEquipment(true)}>
              Add Equipment
            </Button>
          )}
        </div>
        {showAddEquipment && <AddEquipmentForm customerId={id} onDone={() => setShowAddEquipment(false)} />}
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {equipment?.map((eq) => (
            <EquipmentCard key={eq.id} eq={eq} onDelete={() => deleteEquipment.mutate(eq.id)} />
          ))}
          {equipment?.length === 0 && !showAddEquipment && (
            <p className="text-sm text-gray-400">No equipment on file.</p>
          )}
        </div>
      </div>

      <div>
        <div className="mb-3 flex gap-1 border-b">
          {(["jobs", "invoices", "estimates", "service-plans", "messages"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm capitalize ${
                tab === t ? "border-b-2 border-brand font-medium text-brand" : "text-gray-500"
              }`}
            >
              {t.replace("-", " ")}
            </button>
          ))}
        </div>

        {tab === "jobs" && (
          <div className="space-y-2">
            {jobsQuery.data?.map((job) => (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}`}
                className="flex items-center justify-between rounded-md border bg-white p-3 hover:border-brand"
              >
                <span>
                  #{job.jobNumber} — {job.title}
                </span>
                <JobStatusBadge status={job.status} />
              </Link>
            ))}
            {jobsQuery.data?.length === 0 && <p className="text-sm text-gray-400">No jobs yet.</p>}
          </div>
        )}

        {tab === "invoices" && (
          <div className="space-y-2">
            {invoicesQuery.data?.map((inv) => (
              <div key={inv.id} className="rounded-md border bg-white p-3 text-sm">
                #{inv.invoiceNumber} — {inv.status} — ${inv.total}
              </div>
            ))}
            {invoicesQuery.data?.length === 0 && (
              <p className="text-sm text-gray-400">No invoices yet — invoicing arrives in Sprint 4.</p>
            )}
          </div>
        )}

        {tab === "estimates" && (
          <div className="space-y-2">
            {estimatesQuery.data?.map((est) => (
              <div key={est.id} className="rounded-md border bg-white p-3 text-sm">
                #{est.estimateNumber} — {est.status} — ${est.total}
              </div>
            ))}
            {estimatesQuery.data?.length === 0 && (
              <p className="text-sm text-gray-400">No estimates yet — estimates arrive in Sprint 4.</p>
            )}
          </div>
        )}

        {tab === "service-plans" && (
          <div className="space-y-2">
            {servicePlansQuery.data?.map((sp) => (
              <div key={sp.id} className="rounded-md border bg-white p-3 text-sm">
                {sp.name} — {sp.status} — ${sp.price}/{sp.billingCycle.toLowerCase()}
              </div>
            ))}
            {servicePlansQuery.data?.length === 0 && (
              <p className="text-sm text-gray-400">No service plans yet — service plans arrive in Sprint 4B.</p>
            )}
          </div>
        )}

        {tab === "messages" && (
          <p className="text-sm text-gray-400">
            Two-way texting arrives in Sprint 4E once a Twilio number is provisioned for your org.
          </p>
        )}
      </div>
    </div>
  );
}
