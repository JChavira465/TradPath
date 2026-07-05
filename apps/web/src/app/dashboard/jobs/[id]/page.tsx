"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { JobStatus } from "@tradpath/types";
import { useJob, useOnMyWay, useUpdateJobStatus } from "@/hooks/use-jobs";
import { useCustomerEquipment } from "@/hooks/use-customers";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { Button } from "@/components/ui/button";

const NEXT_STATUS: Partial<Record<JobStatus, { label: string; next: JobStatus }>> = {
  SCHEDULED: { label: "Start Job", next: "IN_PROGRESS" },
  IN_PROGRESS: { label: "Put On Hold", next: "ON_HOLD" },
  ON_HOLD: { label: "Resume Job", next: "IN_PROGRESS" },
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: job, isLoading } = useJob(id);
  const updateStatus = useUpdateJobStatus(id);
  const onMyWay = useOnMyWay(id);
  const { data: equipment } = useCustomerEquipment(job?.customerId ?? "");

  if (isLoading || !job) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  const statusAction = NEXT_STATUS[job.status];

  const sendOnMyWay = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => onMyWay.mutate({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => onMyWay.mutate({ latitude: 0, longitude: 0 }),
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-400">#{job.jobNumber}</div>
          <h1 className="text-2xl font-semibold text-navy">{job.title}</h1>
          <div className="mt-2">
            <JobStatusBadge status={job.status} />
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/jobs/${job.id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
          {job.status === "IN_PROGRESS" && (
            <Link href={`/dashboard/jobs/${job.id}/complete`}>
              <Button>Complete Job</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-3 font-medium text-navy">Actions</h2>
            <div className="flex flex-wrap gap-3">
              {statusAction && (
                <Button onClick={() => updateStatus.mutate(statusAction.next)} disabled={updateStatus.isPending}>
                  {statusAction.label}
                </Button>
              )}
              {(job.status === "SCHEDULED" || job.status === "IN_PROGRESS") && (
                <Button variant="outline" onClick={sendOnMyWay} disabled={onMyWay.isPending}>
                  {job.onMyWaySentAt ? "Resend On My Way" : "On My Way"}
                </Button>
              )}
              {job.status !== "CANCELLED" && job.status !== "COMPLETED" && (
                <Button variant="destructive" onClick={() => updateStatus.mutate("CANCELLED")}>
                  Cancel Job
                </Button>
              )}
            </div>
            {job.onMyWaySentAt && (
              <p className="mt-3 text-xs text-gray-400">
                On My Way sent {new Date(job.onMyWaySentAt).toLocaleString()}
              </p>
            )}
          </div>

          {job.description && (
            <div className="rounded-lg border bg-white p-6">
              <h2 className="mb-2 font-medium text-navy">Description</h2>
              <p className="text-sm text-gray-600">{job.description}</p>
            </div>
          )}

          {job.internalNotes && (
            <div className="rounded-lg border bg-white p-6">
              <h2 className="mb-2 font-medium text-navy">Internal Notes</h2>
              <p className="text-sm text-gray-600">{job.internalNotes}</p>
            </div>
          )}

          {job.completionNotes && (
            <div className="rounded-lg border bg-white p-6">
              <h2 className="mb-2 font-medium text-navy">Completion Notes</h2>
              <p className="text-sm text-gray-600">{job.completionNotes}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-2 font-medium text-navy">Customer</h2>
            {job.customer ? (
              <div className="text-sm text-gray-600">
                <div className="font-medium text-gray-800">
                  {job.customer.firstName} {job.customer.lastName}
                </div>
                {job.customer.company && <div>{job.customer.company}</div>}
                {job.customer.phone && <div>{job.customer.phone}</div>}
                {job.customer.email && <div>{job.customer.email}</div>}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No customer linked.</p>
            )}
          </div>

          {equipment && equipment.length > 0 && (
            <div className="rounded-lg border bg-white p-6">
              <h2 className="mb-2 font-medium text-navy">Equipment on Site</h2>
              <div className="space-y-3">
                {equipment.map((item) => {
                  const now = Date.now();
                  const warrantyExpiry = item.warrantyExpiry ? new Date(item.warrantyExpiry).getTime() : null;
                  const nextService = item.nextServiceDate ? new Date(item.nextServiceDate).getTime() : null;
                  const warrantyExpiringSoon = warrantyExpiry && warrantyExpiry > now && warrantyExpiry - now < 30 * 24 * 60 * 60 * 1000;
                  const warrantyExpired = warrantyExpiry && warrantyExpiry <= now;
                  const serviceDueSoon = nextService && nextService - now < 7 * 24 * 60 * 60 * 1000;
                  return (
                    <div key={item.id} className="border-b pb-3 text-sm last:border-b-0 last:pb-0">
                      <div className="font-medium text-gray-800">
                        {item.name}
                        {item.make && ` — ${item.make}`}
                        {item.model && ` ${item.model}`}
                      </div>
                      {item.serialNumber && <div className="text-xs text-gray-400">S/N {item.serialNumber}</div>}
                      {item.installDate && (
                        <div className="text-xs text-gray-500">Installed {new Date(item.installDate).toLocaleDateString()}</div>
                      )}
                      {item.warrantyExpiry && (
                        <div className={`text-xs ${warrantyExpired ? "text-red-600" : warrantyExpiringSoon ? "text-amber-600" : "text-gray-500"}`}>
                          Warranty {warrantyExpired ? "expired" : "expires"} {new Date(item.warrantyExpiry).toLocaleDateString()}
                        </div>
                      )}
                      {item.nextServiceDate && (
                        <div className={`text-xs ${serviceDueSoon ? "text-amber-600" : "text-gray-500"}`}>
                          Next service due {new Date(item.nextServiceDate).toLocaleDateString()}
                        </div>
                      )}
                      {item.notes && <div className="mt-1 text-xs text-gray-500">{item.notes}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-2 font-medium text-navy">Location</h2>
            <p className="text-sm text-gray-600">
              {job.serviceAddress ?? "—"}
              {job.city && `, ${job.city}`}
              {job.state && `, ${job.state}`}
              {job.zip && ` ${job.zip}`}
            </p>
          </div>

          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-2 font-medium text-navy">Schedule</h2>
            <p className="text-sm text-gray-600">
              {job.scheduledStart ? new Date(job.scheduledStart).toLocaleString() : "Not scheduled"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
