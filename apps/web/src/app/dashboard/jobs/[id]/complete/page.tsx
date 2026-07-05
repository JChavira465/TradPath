"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCompleteJob, useJob } from "@/hooks/use-jobs";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const STEPS = [
  "Photos",
  "Notes",
  "Parts & Labor",
  "Invoice Review",
  "Signature",
  "Send & Collect",
  "Done",
] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 items-center">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
              i <= current ? "bg-brand text-white" : "bg-gray-200 text-gray-500",
            )}
          >
            {i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("mx-1 h-0.5 flex-1", i < current ? "bg-brand" : "bg-gray-200")} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function CompleteJobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: job } = useJob(id);
  const completeJob = useCompleteJob(id);

  const [step, setStep] = useState(0);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onUploadPhoto = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", "BEFORE");
      await apiClient.post(`/jobs/${id}/photos`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPhotoCount((n) => n + 1);
    } catch {
      setError("Photo upload failed — check the file type and size.");
    } finally {
      setUploading(false);
    }
  };

  const onFinish = async () => {
    setError(null);
    try {
      await completeJob.mutateAsync(notes || undefined);
      router.push(`/dashboard/jobs/${id}`);
    } catch {
      setError("Could not complete the job.");
    }
  };

  if (!job) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-semibold text-navy">Complete Job #{job.jobNumber}</h1>
      <p className="mb-6 text-sm text-gray-500">{job.title}</p>

      <StepIndicator current={step} />

      <div className="rounded-lg border bg-white p-6">
        {step === 0 && (
          <div>
            <h2 className="mb-2 font-medium text-navy">Add job photos</h2>
            <p className="mb-4 text-sm text-gray-500">
              Required photo checkpoints per service type arrive in Sprint 7 — any photo works for now.
            </p>
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && onUploadPhoto(e.target.files[0])}
            />
            {photoCount > 0 && <p className="mt-2 text-sm text-green-600">{photoCount} photo(s) uploaded.</p>}
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="mb-2 font-medium text-navy">Job notes</h2>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={5}
              placeholder="What was done? Any follow-up needed?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <p className="mt-2 text-xs text-gray-400">Voice-to-text notes arrive in Sprint 6B.</p>
          </div>
        )}

        {(step === 2 || step === 3 || step === 4 || step === 5) && (
          <div className="py-8 text-center text-gray-500">
            <p className="font-medium text-navy">{STEPS[step]}</p>
            <p className="mt-2 text-sm">
              {step === 2 && "Parts & labor line items (price book) arrive in Sprint 4E."}
              {step === 3 && "AI-drafted invoice review arrives in Sprint 6B."}
              {step === 4 && "Customer signature capture arrives in Sprint 7."}
              {step === 5 && "Invoice send + payment collection arrives in Sprint 4."}
            </p>
          </div>
        )}

        {step === 6 && (
          <div className="text-center">
            <h2 className="mb-2 font-medium text-navy">Ready to complete</h2>
            <p className="mb-4 text-sm text-gray-500">
              This marks the job COMPLETED. Work-order PDF generation arrives in Sprint 7.
            </p>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-between">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
          ) : (
            <Button onClick={onFinish} disabled={completeJob.isPending}>
              {completeJob.isPending ? "Completing…" : "Complete Job"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
