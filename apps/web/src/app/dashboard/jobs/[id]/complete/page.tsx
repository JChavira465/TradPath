"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCompleteJob, useJob, useUploadSignature } from "@/hooks/use-jobs";
import { useConfirmInvoiceDraft, useGenerateInvoiceDraft, useTranscribeVoiceMemo } from "@/hooks/use-ai";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceRecorder } from "@/components/jobs/voice-recorder";
import { StreamingTranscript } from "@/components/jobs/streaming-transcript";
import { SignaturePad } from "@/components/jobs/signature-pad";
import { cn } from "@/lib/cn";

const STEPS = [
  "Photos",
  "Notes",
  "Voice → Invoice",
  "Invoice Review",
  "Signature",
  "Send & Collect",
  "Done",
] as const;

interface DraftLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  source: "ai" | "manual";
}

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

  const [transcript, setTranscript] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [unmatchedItems, setUnmatchedItems] = useState<string[]>([]);
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([]);
  const [createdInvoiceNumber, setCreatedInvoiceNumber] = useState<string | null>(null);
  const [customerSigned, setCustomerSigned] = useState(false);
  const [techSigned, setTechSigned] = useState(false);

  const transcribeVoiceMemo = useTranscribeVoiceMemo();
  const generateInvoiceDraft = useGenerateInvoiceDraft();
  const confirmInvoiceDraft = useConfirmInvoiceDraft();
  const uploadSignature = useUploadSignature(id);

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

  const onRecorded = async (blob: Blob) => {
    setError(null);
    setTranscript(null);
    try {
      const result = await transcribeVoiceMemo.mutateAsync({ jobId: id, blob, filename: "memo.webm" });
      if (!result.transcribed) {
        setError("Transcription isn't available right now — enter line items manually below.");
      }
      setTranscript(result.transcript ?? "");
    } catch {
      setError("Could not process the recording — enter line items manually below.");
    }
  };

  const onGenerateDraft = async () => {
    if (!transcript) return;
    setError(null);
    try {
      const draft = await generateInvoiceDraft.mutateAsync({ jobId: id, transcript });
      if (!draft.configured) {
        setAiUnavailable(true);
        return;
      }
      setLineItems(
        draft.lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          source: "ai" as const,
        })),
      );
      setUnmatchedItems(draft.unmatchedItems);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Could not generate an AI invoice draft.");
    }
  };

  const addManualLineItem = (description = "") => {
    setLineItems((items) => [...items, { description, quantity: 1, unitPrice: 0, source: "manual" }]);
  };

  const updateLineItem = (index: number, patch: Partial<DraftLineItem>) => {
    setLineItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeLineItem = (index: number) => {
    setLineItems((items) => items.filter((_, i) => i !== index));
  };

  const total = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const validLineItems = lineItems.filter((li) => li.description && li.quantity > 0 && li.unitPrice >= 0);

  const onCreateInvoice = async () => {
    setError(null);
    try {
      const invoice = await confirmInvoiceDraft.mutateAsync({
        jobId: id,
        lineItems: validLineItems,
        notes: notes || undefined,
      });
      setCreatedInvoiceNumber(invoice.invoiceNumber);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Could not create the invoice.");
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
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="mb-1 font-medium text-navy">Record what you did</h2>
            <p className="mb-2 text-sm text-gray-500">
              Hold the mic, describe the parts and labor used, then let AI draft the invoice. You can always skip
              this and enter line items by hand in the next step.
            </p>

            <VoiceRecorder onRecorded={onRecorded} disabled={transcribeVoiceMemo.isPending} />

            {transcribeVoiceMemo.isPending && (
              <p className="text-center text-sm text-gray-400">Transcribing…</p>
            )}

            {transcript !== null && (
              <div className="mt-4 rounded-md border bg-gray-50 p-3">
                <StreamingTranscript text={transcript} />
              </div>
            )}

            {transcript && (
              <div className="mt-4 flex justify-center">
                <Button onClick={onGenerateDraft} disabled={generateInvoiceDraft.isPending}>
                  {generateInvoiceDraft.isPending ? "Drafting invoice…" : "Generate AI Invoice Draft"}
                </Button>
              </div>
            )}

            {aiUnavailable && (
              <p className="mt-3 text-center text-xs text-amber-600">
                AI drafting isn't available on this plan — continue to enter line items manually.
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="mb-3 font-medium text-navy">Review invoice line items</h2>

            {unmatchedItems.length > 0 && (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="mb-2 text-xs font-medium text-amber-800">Mentioned but not matched to price book:</p>
                <div className="flex flex-wrap gap-2">
                  {unmatchedItems.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        addManualLineItem(item);
                        setUnmatchedItems((items) => items.filter((_, idx) => idx !== i));
                      }}
                      className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs text-amber-800 hover:bg-amber-100"
                    >
                      + {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {lineItems.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    "grid grid-cols-12 items-center gap-2 rounded-md border p-2",
                    item.source === "ai" ? "border-green-300 bg-green-50" : "border-gray-200",
                  )}
                >
                  <Input
                    className="col-span-6"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateLineItem(i, { description: e.target.value })}
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    min={0.01}
                    max={999}
                    step="1"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(i, { quantity: Number(e.target.value) })}
                  />
                  <Input
                    className="col-span-3"
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateLineItem(i, { unitPrice: Number(e.target.value) })}
                  />
                  <button
                    type="button"
                    className="col-span-1 text-xs text-gray-400 hover:text-red-600"
                    onClick={() => removeLineItem(i)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="mt-3 text-sm text-brand hover:underline"
              onClick={() => addManualLineItem()}
            >
              + Add manual line item
            </button>

            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <span className="text-sm text-gray-500">Total</span>
              <span className="font-medium text-navy">${total.toFixed(2)}</span>
            </div>

            {createdInvoiceNumber ? (
              <p className="mt-3 text-sm text-green-600">Invoice #{createdInvoiceNumber} created.</p>
            ) : (
              <Button
                className="mt-3 w-full"
                onClick={onCreateInvoice}
                disabled={validLineItems.length === 0 || confirmInvoiceDraft.isPending}
              >
                {confirmInvoiceDraft.isPending ? "Creating invoice…" : "Create Invoice"}
              </Button>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h2 className="font-medium text-navy">Capture signatures</h2>
            {techSigned ? (
              <p className="text-sm text-green-600">Technician signature captured.</p>
            ) : (
              <SignaturePad
                label="Technician signature"
                saving={uploadSignature.isPending}
                onSave={async (blob) => {
                  await uploadSignature.mutateAsync({ blob, role: "TECHNICIAN" });
                  setTechSigned(true);
                }}
              />
            )}
            {customerSigned ? (
              <p className="text-sm text-green-600">Customer signature captured.</p>
            ) : (
              <SignaturePad
                label="Customer signature"
                saving={uploadSignature.isPending}
                onSave={async (blob) => {
                  await uploadSignature.mutateAsync({ blob, role: "CUSTOMER" });
                  setCustomerSigned(true);
                }}
              />
            )}
          </div>
        )}

        {step === 5 && (
          <div className="py-8 text-center text-gray-500">
            <p className="font-medium text-navy">{STEPS[step]}</p>
            <p className="mt-2 text-sm">
              {createdInvoiceNumber
                ? `Invoice #${createdInvoiceNumber} is ready — send it from the Invoices page.`
                : "No invoice was created for this job."}
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
