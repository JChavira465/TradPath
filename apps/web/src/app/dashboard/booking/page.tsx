"use client";

import { useState } from "react";
import Link from "next/link";
import type { BookingRequest } from "@tradpath/types";
import {
  useBookingRequests,
  useConfirmBookingRequest,
  useDeclineBookingRequest,
  useRescheduleBookingRequest,
} from "@/hooks/use-booking";
import { InvoicingStatusBadge } from "@/components/invoicing/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function RescheduleForm({ request, onDone }: { request: BookingRequest; onDone: () => void }) {
  const reschedule = useRescheduleBookingRequest();
  const [date, setDate] = useState(request.requestedDate ? request.requestedDate.slice(0, 10) : "");
  const [timeSlot, setTimeSlot] = useState(request.requestedTimeSlot ?? "");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await reschedule.mutateAsync({ id: request.id, requestedDate: date, requestedTimeSlot: timeSlot || undefined });
    onDone();
  };

  return (
    <form onSubmit={onSubmit} className="mt-3 flex items-center gap-2 border-t pt-3">
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-auto" />
      <Input placeholder="Time (e.g. 10:00)" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} className="w-auto" />
      <Button type="submit" disabled={reschedule.isPending}>
        Save
      </Button>
      <Button type="button" variant="outline" onClick={onDone}>
        Cancel
      </Button>
    </form>
  );
}

export default function BookingRequestsPage() {
  const { data: requests, isLoading } = useBookingRequests();
  const confirm = useConfirmBookingRequest();
  const decline = useDeclineBookingRequest();
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Booking Requests</h1>
        <Link href="/dashboard/booking/settings">
          <Button variant="outline">Booking Settings</Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="space-y-3">
          {requests?.map((req) => (
            <div key={req.id} className="rounded-lg border bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-navy">
                    {req.firstName} {req.lastName}
                  </div>
                  <div className="text-sm text-gray-500">
                    {req.phone} · {req.email}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">{req.serviceAddress}</div>
                  {req.requestedDate && (
                    <div className="mt-1 text-xs text-gray-400">
                      Requested: {new Date(req.requestedDate).toLocaleDateString()} {req.requestedTimeSlot}
                    </div>
                  )}
                  {req.notes && <div className="mt-2 text-sm text-gray-500">&ldquo;{req.notes}&rdquo;</div>}
                  <div className="mt-1 text-xs text-gray-400">Confirmation: {req.confirmationCode}</div>
                </div>
                <div className="flex items-center gap-2">
                  <InvoicingStatusBadge status={req.status} />
                  {req.status === "PENDING" && (
                    <>
                      <Button onClick={() => confirm.mutate(req.id)} disabled={confirm.isPending}>
                        Confirm
                      </Button>
                      <Button variant="outline" onClick={() => setReschedulingId(req.id)}>
                        Reschedule
                      </Button>
                      <Button variant="outline" onClick={() => decline.mutate(req.id)} disabled={decline.isPending}>
                        Decline
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {reschedulingId === req.id && (
                <RescheduleForm request={req} onDone={() => setReschedulingId(null)} />
              )}
            </div>
          ))}
          {requests?.length === 0 && <p className="text-sm text-gray-400">No booking requests yet.</p>}
        </div>
      )}
    </div>
  );
}
