"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useJob, useUpdateJob } from "@/hooks/use-jobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function EditJobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: job, isLoading } = useJob(id);
  const updateJob = useUpdateJob(id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (job) {
      setTitle(job.title);
      setDescription(job.description ?? "");
      setPriority(job.priority);
    }
  }, [job]);

  if (isLoading || !job) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await updateJob.mutateAsync({ title, description: description || undefined, priority });
      router.push(`/dashboard/jobs/${id}`);
    } catch {
      setError("Could not save changes.");
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold text-navy">Edit Job #{job.jobNumber}</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateJob.isPending}>
            {updateJob.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
