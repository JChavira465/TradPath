"use client";

import { useState } from "react";
import { downloadAuditLogsCsv, useAuditLogs } from "@/hooks/use-admin-audit-logs";

export default function AuditLogsPage() {
  const [action, setAction] = useState("");
  const [superAdminOnly, setSuperAdminOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const filters = { action: action || undefined, isSuperAdminAction: superAdminOnly ? "true" : undefined };
  const { data, isLoading } = useAuditLogs(filters);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Audit Logs</h1>
        <button
          onClick={() => downloadAuditLogsCsv(filters)}
          className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/80 hover:bg-white/20"
        >
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Filter by action (e.g. COMPANY_SUSPENDED)"
          className="w-72 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
        />
        <label className="flex items-center gap-1 text-sm text-white/70">
          <input type="checkbox" checked={superAdminOnly} onChange={(e) => setSuperAdminOnly(e.target.checked)} />
          Super admin actions only
        </label>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-white/60">Loading…</p>
      ) : (
        <div className="space-y-2">
          {data.logs.map((log) => (
            <div key={log.id} className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-white">
                  <span className="font-medium">{log.action}</span>
                  <span className="ml-2 text-white/50">
                    {log.resource}
                    {log.resourceId ? `#${log.resourceId.slice(0, 8)}` : ""}
                  </span>
                </div>
                <div className="text-xs text-white/40">
                  {log.organization?.name ?? "—"} · {log.user?.email ?? "system"} · {new Date(log.createdAt).toLocaleString()}
                  {log.isSuperAdminAction && <span className="ml-2 text-purple">admin</span>}
                </div>
              </div>
              {!!(log.oldValue || log.newValue) && (
                <button
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  className="mt-1 text-xs text-purple hover:underline"
                >
                  {expandedId === log.id ? "Hide diff" : "Show diff"}
                </button>
              )}
              {expandedId === log.id && (
                <pre className="mt-2 overflow-x-auto rounded bg-adminbg p-2 text-xs text-white/60">
                  {JSON.stringify({ old: log.oldValue, new: log.newValue }, null, 2)}
                </pre>
              )}
            </div>
          ))}
          {data.logs.length === 0 && <p className="text-sm text-white/40">No matching audit logs.</p>}
        </div>
      )}
    </div>
  );
}
