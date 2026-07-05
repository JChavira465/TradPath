"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, dateFnsLocalizer, Views, type View } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { format } from "date-fns/format";
import { parse } from "date-fns/parse";
import { startOfWeek } from "date-fns/startOfWeek";
import { getDay } from "date-fns/getDay";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

import type { Job, OrgUser, ScheduleEvent } from "@tradpath/types";
import {
  useCalendarJobs,
  useCreateScheduleEvent,
  useDeleteScheduleEvent,
  useRescheduleJob,
  useScheduleEvents,
  useUnscheduledJobs,
  useUpdateScheduleEvent,
} from "@/hooks/use-schedule";
import { useOrgUsers } from "@/hooks/use-users";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 0 }),
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(Calendar);

interface CalendarItem {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  kind: "job" | "event";
  job?: Job;
  event?: ScheduleEvent;
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "#2563EB",
  IN_PROGRESS: "#D97706",
  ON_HOLD: "#6B7280",
  COMPLETED: "#16A34A",
  CANCELLED: "#DC2626",
};

function rangeFor(date: Date, view: View): { from: Date; to: Date } {
  if (view === Views.MONTH) {
    const from = new Date(date.getFullYear(), date.getMonth(), 1);
    const to = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    return { from, to };
  }
  if (view === Views.DAY) {
    const from = new Date(date);
    from.setHours(0, 0, 0, 0);
    const to = new Date(date);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  const from = startOfWeek(date, { weekStartsOn: 0 });
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function userName(users: OrgUser[] | undefined, id: string) {
  const user = users?.find((u) => u.id === id);
  return user ? `${user.firstName} ${user.lastName}` : id;
}

export default function SchedulePage() {
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(new Date());
  const [crewFilter, setCrewFilter] = useState("");
  const [draggedJob, setDraggedJob] = useState<Job | null>(null);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [createSlot, setCreateSlot] = useState<{ start: Date; end: Date } | null>(null);

  const { from, to } = useMemo(() => rangeFor(date, view), [date, view]);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const { data: jobs } = useCalendarJobs(fromIso, toIso, crewFilter || undefined);
  const { data: events } = useScheduleEvents(fromIso, toIso);
  const { data: unscheduled } = useUnscheduledJobs();
  const { data: users } = useOrgUsers();

  const rescheduleJob = useRescheduleJob();
  const updateEvent = useUpdateScheduleEvent();
  const createEvent = useCreateScheduleEvent();
  const deleteEvent = useDeleteScheduleEvent();

  const items: CalendarItem[] = useMemo(() => {
    const jobItems: CalendarItem[] = (jobs ?? [])
      .filter((j) => j.scheduledStart)
      .map((j) => ({
        id: `job-${j.id}`,
        title: j.title,
        start: new Date(j.scheduledStart as string),
        end: j.scheduledEnd
          ? new Date(j.scheduledEnd)
          : new Date(new Date(j.scheduledStart as string).getTime() + 60 * 60 * 1000),
        allDay: false,
        kind: "job" as const,
        job: j,
      }));
    const eventItems: CalendarItem[] = (events ?? [])
      .filter((e) => !crewFilter || e.assignedUserIds.length === 0 || e.assignedUserIds.includes(crewFilter))
      .map((e) => ({
        id: `event-${e.id}`,
        title: e.title,
        start: new Date(e.start),
        end: new Date(e.end),
        allDay: e.allDay,
        kind: "event" as const,
        event: e,
      }));
    return [...jobItems, ...eventItems];
  }, [jobs, events, crewFilter]);

  const eventPropGetter = useCallback((item: CalendarItem) => {
    let backgroundColor = "#7C3AED";
    let isRecurring = false;
    let isCancelled = false;
    if (item.kind === "job" && item.job) {
      backgroundColor = STATUS_COLORS[item.job.status] ?? "#2563EB";
      isRecurring = item.job.type === "RECURRING";
      isCancelled = item.job.status === "CANCELLED";
    } else if (item.kind === "event" && item.event) {
      backgroundColor = item.event.color ?? "#7C3AED";
    }
    return {
      style: {
        backgroundColor,
        borderStyle: isRecurring ? "dashed" : "solid",
        borderWidth: isRecurring ? 2 : 0,
        borderColor: "#ffffff",
        opacity: isCancelled ? 0.5 : 1,
      },
    };
  }, []);

  const EventComponent = useCallback(({ event }: { event: CalendarItem }) => {
    const isBooking = event.kind === "job" && !!event.job?.bookingRequestId;
    const isPlanJob = event.kind === "job" && !!event.job?.servicePlanId;
    return (
      <span className="text-xs">
        {isBooking && <span title="Booking-sourced">📅 </span>}
        {isPlanJob && <span title="Service plan job">🔁 </span>}
        {event.title}
      </span>
    );
  }, []);

  const onEventDrop = useCallback(
    ({ event, start, end }: { event: CalendarItem; start: Date; end: Date }) => {
      if (event.kind === "job" && event.job) {
        rescheduleJob.mutate({
          id: event.job.id,
          data: { scheduledStart: start.toISOString(), scheduledEnd: end.toISOString() },
        });
      } else if (event.kind === "event" && event.event) {
        updateEvent.mutate({ id: event.event.id, data: { start: start.toISOString(), end: end.toISOString() } });
      }
    },
    [rescheduleJob, updateEvent],
  );

  const onSelectSlot = useCallback((slotInfo: { start: Date; end: Date }) => {
    setCreateSlot({ start: slotInfo.start, end: slotInfo.end });
  }, []);

  const onSelectEvent = useCallback((item: CalendarItem) => {
    setSelectedItem(item);
  }, []);

  const onDropFromOutside = useCallback(
    ({ start, end }: { start: Date; end: Date }) => {
      if (!draggedJob) return;
      rescheduleJob.mutate({
        id: draggedJob.id,
        data: { scheduledStart: start.toISOString(), scheduledEnd: end.toISOString() },
      });
      setDraggedJob(null);
    },
    [draggedJob, rescheduleJob],
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="w-64 shrink-0 overflow-y-auto rounded-lg border bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold text-navy">Unscheduled Jobs</h2>
        <div className="space-y-2">
          {unscheduled?.map((job) => (
            <div
              key={job.id}
              draggable
              onDragStart={() => setDraggedJob(job)}
              onDragEnd={() => setDraggedJob(null)}
              className="cursor-move rounded-md border border-gray-200 bg-gray-50 p-2 text-xs hover:border-brand"
            >
              <div className="font-medium text-gray-800">{job.title}</div>
              <div className="text-gray-400">
                {job.customer ? `${job.customer.firstName} ${job.customer.lastName}` : "No customer"}
              </div>
            </div>
          ))}
          {unscheduled?.length === 0 && <p className="text-xs text-gray-400">Nothing unscheduled.</p>}
        </div>
      </div>

      <div className="flex flex-1 flex-col rounded-lg border bg-white p-3">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-navy">Schedule</h1>
          <select
            className="h-9 rounded-md border border-gray-300 px-2 text-sm"
            value={crewFilter}
            onChange={(e) => setCrewFilter(e.target.value)}
          >
            <option value="">All crew</option>
            {users?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <DnDCalendar
            localizer={localizer}
            events={items}
            view={view}
            date={date}
            onView={setView}
            onNavigate={setDate}
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            startAccessor="start"
            endAccessor="end"
            allDayAccessor="allDay"
            style={{ height: "100%" }}
            selectable
            resizable
            eventPropGetter={eventPropGetter}
            components={{ event: EventComponent }}
            onEventDrop={onEventDrop}
            onEventResize={onEventDrop}
            onSelectSlot={onSelectSlot}
            onSelectEvent={onSelectEvent}
            onDropFromOutside={onDropFromOutside}
            dragFromOutsideItem={() => (draggedJob ? { title: draggedJob.title } : undefined)}
          />
        </div>
      </div>

      {selectedItem && (
        <div className="fixed inset-y-0 right-0 z-40 w-96 overflow-y-auto border-l bg-white p-6 shadow-xl">
          <button onClick={() => setSelectedItem(null)} className="mb-4 text-sm text-gray-400 hover:text-navy">
            Close ✕
          </button>
          {selectedItem.kind === "job" && selectedItem.job ? (
            <JobPanel job={selectedItem.job} users={users} />
          ) : selectedItem.kind === "event" && selectedItem.event ? (
            <EventPanel
              event={selectedItem.event}
              users={users}
              onDelete={() => {
                deleteEvent.mutate(selectedItem.event!.id);
                setSelectedItem(null);
              }}
            />
          ) : null}
        </div>
      )}

      {createSlot && (
        <CreateEventPanel
          slot={createSlot}
          users={users ?? []}
          onClose={() => setCreateSlot(null)}
          onCreate={async (data) => {
            await createEvent.mutateAsync(data);
            setCreateSlot(null);
          }}
        />
      )}
    </div>
  );
}

function JobPanel({ job, users }: { job: Job; users?: OrgUser[] }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-gray-400">#{job.jobNumber}</div>
        <h2 className="text-lg font-semibold text-navy">{job.title}</h2>
        <div className="mt-2">
          <JobStatusBadge status={job.status} />
        </div>
      </div>
      {job.customer && (
        <div className="text-sm text-gray-600">
          <div className="font-medium text-gray-800">
            {job.customer.firstName} {job.customer.lastName}
          </div>
          {job.customer.phone && <div>{job.customer.phone}</div>}
        </div>
      )}
      <div className="text-sm text-gray-600">
        {job.serviceAddress ?? "—"}
        {job.city && `, ${job.city}`}
        {job.state && `, ${job.state}`}
      </div>
      <div className="text-sm text-gray-600">
        {job.scheduledStart ? new Date(job.scheduledStart).toLocaleString() : "Not scheduled"}
        {job.scheduledEnd && ` – ${new Date(job.scheduledEnd).toLocaleTimeString()}`}
      </div>
      {job.assignedUserIds.length > 0 && (
        <div className="text-sm text-gray-600">
          Assigned: {job.assignedUserIds.map((id) => userName(users, id)).join(", ")}
        </div>
      )}
      {(job.bookingRequestId || job.servicePlanId) && (
        <div className="flex gap-2 text-xs text-gray-500">
          {job.bookingRequestId && <span className="rounded bg-blue-50 px-2 py-1">Booking-sourced</span>}
          {job.servicePlanId && <span className="rounded bg-purple-50 px-2 py-1">Service plan job</span>}
        </div>
      )}
      <Link href={`/dashboard/jobs/${job.id}`}>
        <Button className="w-full">View Full Job</Button>
      </Link>
    </div>
  );
}

function EventPanel({ event, users, onDelete }: { event: ScheduleEvent; users?: OrgUser[]; onDelete: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-navy">{event.title}</h2>
      {event.description && <p className="text-sm text-gray-600">{event.description}</p>}
      <div className="text-sm text-gray-600">
        {new Date(event.start).toLocaleString()} – {new Date(event.end).toLocaleTimeString()}
      </div>
      {event.assignedUserIds.length > 0 && (
        <div className="text-sm text-gray-600">
          Assigned: {event.assignedUserIds.map((id) => userName(users, id)).join(", ")}
        </div>
      )}
      {event.job && (
        <Link href={`/dashboard/jobs/${event.job.id}`} className="text-sm text-brand hover:underline">
          Linked job: #{event.job.jobNumber} {event.job.title}
        </Link>
      )}
      <Button variant="destructive" className="w-full" onClick={onDelete}>
        Delete Event
      </Button>
    </div>
  );
}

function CreateEventPanel({
  slot,
  users,
  onClose,
  onCreate,
}: {
  slot: { start: Date; end: Date };
  users: OrgUser[];
  onClose: () => void;
  onCreate: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [start, setStart] = useState(toLocalInputValue(slot.start));
  const [end, setEnd] = useState(toLocalInputValue(slot.end));
  const [submitting, setSubmitting] = useState(false);

  const toggleUser = (id: string) => {
    setAssignedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCreate({
        title,
        assignedUserIds,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 overflow-y-auto border-l bg-white p-6 shadow-xl">
      <button onClick={onClose} className="mb-4 text-sm text-gray-400 hover:text-navy">
        Close ✕
      </button>
      <h2 className="mb-4 text-lg font-semibold text-navy">New Event</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <Input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div>
          <label className="mb-1 block text-xs text-gray-500">Start</label>
          <Input type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">End</label>
          <Input type="datetime-local" required value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Assign</label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded border p-2">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={assignedUserIds.includes(u.id)}
                  onChange={() => toggleUser(u.id)}
                />
                {u.firstName} {u.lastName}
              </label>
            ))}
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          Create Event
        </Button>
      </form>
    </div>
  );
}

function toLocalInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}
