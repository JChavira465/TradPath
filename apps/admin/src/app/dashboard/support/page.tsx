"use client";

import { useState } from "react";
import { useSupportTickets, useUpdateTicket } from "@/hooks/use-admin-support";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export default function SupportTicketsPage() {
  const [status, setStatus] = useState("");
  const { data, isLoading } = useSupportTickets(status);
  const updateTicket = useUpdateTicket();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Support Tickets</h1>

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
      >
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {isLoading || !data ? (
        <p className="text-sm text-white/60">Loading…</p>
      ) : (
        <div className="space-y-2">
          {data.tickets.map((t) => (
            <div key={t.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">{t.title}</div>
                  <div className="text-xs text-white/50">
                    {t.organization.name} — {t.user.email}
                  </div>
                </div>
                <select
                  value={t.status}
                  onChange={(e) => updateTicket.mutate({ id: t.id, status: e.target.value })}
                  className="rounded-md border border-white/10 bg-adminbg px-2 py-1 text-sm text-white"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-sm text-white/70">{t.description}</p>
            </div>
          ))}
          {data.tickets.length === 0 && <p className="text-sm text-white/40">No tickets.</p>}
        </div>
      )}
    </div>
  );
}
