"use client";

import { useMemo, useState } from "react";
import type { TimeEntry } from "@tradpath/types";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTodayJobs } from "@/hooks/use-jobs";
import { useOrgUsers } from "@/hooks/use-users";
import {
  downloadTimesheetCsv,
  useActiveTimeEntry,
  useApproveTimeEntry,
  useClockIn,
  useClockOut,
  useDeleteTimeEntry,
  useEndBreak,
  useRejectTimeEntry,
  useStartBreak,
  useTimeEntries,
  useTimesheet,
  useUpdateTimeEntry,
} from "@/hooks/use-time-entries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function isoDateNDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayIso() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function getGeolocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ latitude: 0, longitude: 0 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve({ latitude: 0, longitude: 0 }),
    );
  });
}

export default function TimeTrackingPage() {
  const { data: currentUser } = useCurrentUser();
  const isManager = currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";

  const [from, setFrom] = useState(isoDateNDaysAgo(7));
  const [to, setTo] = useState(endOfTodayIso());
  const [userFilter, setUserFilter] = useState("");
  const [jobIdForClockIn, setJobIdForClockIn] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: active } = useActiveTimeEntry();
  const { data: todayJobs } = useTodayJobs();
  const { data: users } = useOrgUsers();
  const { data: entries, isLoading } = useTimeEntries({ from, to, userId: userFilter || undefined });
  const { data: timesheet } = useTimesheet({ from, to, userId: userFilter || undefined });

  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const startBreak = useStartBreak();
  const endBreak = useEndBreak();
  const updateEntry = useUpdateTimeEntry();
  const approveEntry = useApproveTimeEntry();
  const rejectEntry = useRejectTimeEntry();
  const deleteEntry = useDeleteTimeEntry();

  const userName = useMemo(() => {
    const map = new Map((users ?? []).map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return (id: string) => map.get(id) ?? id;
  }, [users]);

  const onClockIn = async () => {
    const coords = await getGeolocation();
    clockIn.mutate({ jobId: jobIdForClockIn || undefined, ...coords });
  };

  const onClockOut = async () => {
    const coords = await getGeolocation();
    clockOut.mutate(coords);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-navy">Time Tracking</h1>

      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-3 font-medium text-navy">Clock</h2>
        {active ? (
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              Clocked in since {new Date(active.clockIn).toLocaleTimeString()}
              {active.job && ` on #${active.job.jobNumber} ${active.job.title}`}
            </div>
            {active.breakStartedAt ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-amber-600">
                  On break since {new Date(active.breakStartedAt).toLocaleTimeString()}
                </span>
                <Button variant="outline" onClick={() => endBreak.mutate()} disabled={endBreak.isPending}>
                  End Break
                </Button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => startBreak.mutate()} disabled={startBreak.isPending}>
                  Start Break
                </Button>
                <Button variant="destructive" onClick={onClockOut} disabled={clockOut.isPending}>
                  Clock Out
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <select
              className="h-10 rounded-md border border-gray-300 px-3 text-sm"
              value={jobIdForClockIn}
              onChange={(e) => setJobIdForClockIn(e.target.value)}
            >
              <option value="">No specific job</option>
              {todayJobs?.map((job) => (
                <option key={job.id} value={job.id}>
                  #{job.jobNumber} {job.title}
                </option>
              ))}
            </select>
            <Button onClick={onClockIn} disabled={clockIn.isPending}>
              Clock In
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-gray-500">From</label>
          <Input type="date" value={from.slice(0, 10)} onChange={(e) => setFrom(new Date(e.target.value).toISOString())} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">To</label>
          <Input
            type="date"
            value={to.slice(0, 10)}
            onChange={(e) => {
              const d = new Date(e.target.value);
              d.setHours(23, 59, 59, 999);
              setTo(d.toISOString());
            }}
          />
        </div>
        {isManager && (
          <div>
            <label className="mb-1 block text-xs text-gray-500">Employee</label>
            <select
              className="h-10 rounded-md border border-gray-300 px-3 text-sm"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
            >
              <option value="">Everyone</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
          </div>
        )}
        <Button variant="outline" onClick={() => downloadTimesheetCsv({ from, to, userId: userFilter || undefined })}>
          Export CSV
        </Button>
      </div>

      {timesheet && timesheet.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Total Hrs</th>
                <th className="px-4 py-3">Regular Hrs</th>
                <th className="px-4 py-3">Overtime Hrs</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {timesheet.map((row) => (
                <tr key={row.userId}>
                  <td className="px-4 py-3 font-medium text-gray-800">{row.name}</td>
                  <td className="px-4 py-3 text-gray-500">{row.totalHours}</td>
                  <td className="px-4 py-3 text-gray-500">{row.regularHours}</td>
                  <td className={`px-4 py-3 ${row.overtimeHours > 0 ? "font-medium text-amber-600" : "text-gray-500"}`}>
                    {row.overtimeHours}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Job</th>
              <th className="px-4 py-3">Clock In</th>
              <th className="px-4 py-3">Clock Out</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">Status</th>
              {isManager && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {entries?.map((entry) =>
              editingId === entry.id ? (
                <EditRow
                  key={entry.id}
                  entry={entry}
                  onCancel={() => setEditingId(null)}
                  onSave={async (data) => {
                    await updateEntry.mutateAsync({ id: entry.id, data });
                    setEditingId(null);
                  }}
                />
              ) : (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{userName(entry.userId)}</td>
                  <td className="px-4 py-3 text-gray-500">{entry.job ? `#${entry.job.jobNumber}` : "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(entry.clockIn).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {entry.clockOut ? new Date(entry.clockOut).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{entry.totalHours ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={entry.status} />
                  </td>
                  {isManager && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2 text-xs">
                        <button className="text-gray-400 hover:text-navy" onClick={() => setEditingId(entry.id)}>
                          Edit
                        </button>
                        {entry.status === "COMPLETED" && (
                          <>
                            <button
                              className="text-green-600 hover:underline"
                              onClick={() => approveEntry.mutate(entry.id)}
                            >
                              Approve
                            </button>
                            <button className="text-red-600 hover:underline" onClick={() => rejectEntry.mutate(entry.id)}>
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          className="text-gray-400 hover:text-red-600"
                          onClick={() => deleteEntry.mutate(entry.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ),
            )}
            {entries?.length === 0 && !isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No time entries in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TimeEntry["status"] }) {
  const styles: Record<TimeEntry["status"], string> = {
    ACTIVE: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-gray-200 text-gray-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>{status}</span>;
}

function EditRow({
  entry,
  onCancel,
  onSave,
}: {
  entry: TimeEntry;
  onCancel: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [clockIn, setClockIn] = useState(entry.clockIn.slice(0, 16));
  const [clockOut, setClockOut] = useState(entry.clockOut?.slice(0, 16) ?? "");
  const [breakMinutes, setBreakMinutes] = useState(entry.breakMinutes);
  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    setSaving(true);
    try {
      await onSave({
        clockIn: new Date(clockIn).toISOString(),
        clockOut: clockOut ? new Date(clockOut).toISOString() : undefined,
        breakMinutes,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="bg-blue-50">
      <td className="px-4 py-3" colSpan={2}>
        <span className="text-xs text-gray-500">Break (min)</span>
        <Input
          type="number"
          min={0}
          value={breakMinutes}
          onChange={(e) => setBreakMinutes(Number(e.target.value))}
          className="mt-1 w-20"
        />
      </td>
      <td className="px-4 py-3">
        <Input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
      </td>
      <td className="px-4 py-3">
        <Input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
      </td>
      <td className="px-4 py-3" colSpan={2}>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSubmit} disabled={saving}>
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </td>
    </tr>
  );
}
