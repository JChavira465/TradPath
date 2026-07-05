"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomers } from "@/hooks/use-customers";
import { useCreateJob } from "@/hooks/use-jobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NewJobPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: customers } = useCustomers();
  const createJob = useCreateJob();

  const [customerId, setCustomerId] = useState(searchParams.get("customerId") ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [scheduledStart, setScheduledStart] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const job = await createJob.mutateAsync({
        customerId,
        title,
        description: description || undefined,
        priority,
        scheduledStart: scheduledStart ? new Date(scheduledStart).toISOString() : undefined,
      });
      router.push(`/dashboard/jobs/${job.id}`);
    } catch {
      setError("Could not create job — check the fields and try again.");
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold text-navy">New Job</h1>
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
                {c.firstName} {c.lastName} {c.company ? `(${c.company})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AC not cooling" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
          <textarea
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
            <select
              className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Scheduled start</label>
            <Input
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={createJob.isPending}>
            {createJob.isPending ? "Creating…" : "Create Job"}
          </Button>
        </div>
      </form>
    </div>
  );
}
