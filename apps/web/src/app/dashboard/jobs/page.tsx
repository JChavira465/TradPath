"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Job, JobStatus } from "@tradpath/types";
import { useJobs } from "@/hooks/use-jobs";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

const KANBAN_COLUMNS: JobStatus[] = ["SCHEDULED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"];

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function JobCard({ job }: { job: Job }) {
  return (
    <Link
      href={`/dashboard/jobs/${job.id}`}
      className="block rounded-md border bg-white p-3 shadow-sm hover:border-brand"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">#{job.jobNumber}</span>
        <JobStatusBadge status={job.status} />
      </div>
      <div className="mt-1 font-medium text-navy">{job.title}</div>
      <div className="text-sm text-gray-500">
        {job.customer ? `${job.customer.firstName} ${job.customer.lastName}` : ""}
      </div>
      <div className="mt-1 text-xs text-gray-400">{formatDate(job.scheduledStart)}</div>
    </Link>
  );
}

export default function JobsPage() {
  const [view, setView] = useState<"list" | "kanban">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | undefined>(undefined);

  const { data, isLoading } = useJobs({ search: search || undefined, status: statusFilter });
  const jobs = data?.items ?? [];

  const byStatus = useMemo(() => {
    const groups: Record<JobStatus, Job[]> = {
      SCHEDULED: [],
      IN_PROGRESS: [],
      ON_HOLD: [],
      COMPLETED: [],
      CANCELLED: [],
    };
    for (const job of jobs) groups[job.status].push(job);
    return groups;
  }, [jobs]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Jobs</h1>
        <Link href="/dashboard/jobs/new">
          <Button>New Job</Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="h-10 rounded-md border border-gray-300 px-3 text-sm"
          value={statusFilter ?? ""}
          onChange={(e) => setStatusFilter((e.target.value || undefined) as JobStatus | undefined)}
        >
          <option value="">All statuses</option>
          {KANBAN_COLUMNS.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>

        <div className="ml-auto flex overflow-hidden rounded-md border">
          <button
            className={cn("px-3 py-2 text-sm", view === "list" ? "bg-navy text-white" : "bg-white text-gray-600")}
            onClick={() => setView("list")}
          >
            List
          </button>
          <button
            className={cn("px-3 py-2 text-sm", view === "kanban" ? "bg-navy text-white" : "bg-white text-gray-600")}
            onClick={() => setView("kanban")}
          >
            Kanban
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : view === "list" ? (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Job #</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Scheduled</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs.map((job) => (
                <tr key={job.id} className="cursor-pointer hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/jobs/${job.id}`}>#{job.jobNumber}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/jobs/${job.id}`}>{job.title}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {job.customer ? `${job.customer.firstName} ${job.customer.lastName}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(job.scheduledStart)}</td>
                  <td className="px-4 py-3">
                    <JobStatusBadge status={job.status} />
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No jobs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {KANBAN_COLUMNS.map((status) => (
            <div key={status} className="rounded-lg bg-gray-100 p-3">
              <div className="mb-3 flex items-center justify-between">
                <JobStatusBadge status={status} />
                <span className="text-xs text-gray-400">{byStatus[status].length}</span>
              </div>
              <div className="space-y-2">
                {byStatus[status].map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
