"use client";

import { useRetryFailedJobs, useSystemHealth } from "@/hooks/use-admin-system-health";

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${ok ? "bg-green-600/20 text-green-300" : "bg-red-600/20 text-red-300"}`}
    >
      {ok ? "ok" : "down"}
    </span>
  );
}

export default function SystemHealthPage() {
  const { data, isLoading } = useSystemHealth();
  const retryFailed = useRetryFailedJobs();

  if (isLoading || !data) {
    return <p className="text-sm text-white/60">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">System Health</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>API</span>
            <StatusPill ok={data.api.status === "ok"} />
          </div>
          <div className="mt-1 text-sm text-white">Uptime {Math.round(data.api.uptimeSeconds / 60)}m</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Database</span>
            <StatusPill ok={data.db.status === "ok"} />
          </div>
          <div className="mt-1 text-sm text-white">{data.db.latencyMs ?? "—"}ms</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Redis</span>
            <StatusPill ok={data.redis.status === "ok"} />
          </div>
          <div className="mt-1 text-sm text-white">{data.redis.latencyMs ?? "—"}ms</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/50">Error rate (24h)</div>
          <div className="mt-1 text-sm text-white">{data.errorRate.errorRatePercent}%</div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 font-medium text-white">External services</h2>
        <div className="grid grid-cols-2 gap-2 text-sm text-white/70 md:grid-cols-3">
          {Object.entries(data.externalServices).map(([name, ok]) => (
            <div key={name} className="flex items-center justify-between rounded border border-white/10 px-3 py-2">
              <span>{name}</span>
              <StatusPill ok={ok} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 font-medium text-white">Bull queues</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-white/50">
              <tr>
                <th className="px-2 py-1">Queue</th>
                <th className="px-2 py-1">Waiting</th>
                <th className="px-2 py-1">Active</th>
                <th className="px-2 py-1">Completed</th>
                <th className="px-2 py-1">Failed</th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {data.queues.map((q) => (
                <tr key={q.name} className="border-t border-white/10 text-white/80">
                  <td className="px-2 py-1">{q.name}</td>
                  <td className="px-2 py-1">{q.waiting ?? "—"}</td>
                  <td className="px-2 py-1">{q.active ?? "—"}</td>
                  <td className="px-2 py-1">{q.completed ?? "—"}</td>
                  <td className="px-2 py-1">
                    <span className={q.failed && q.failed > 0 ? "text-red-400" : ""}>{q.failed ?? "—"}</span>
                  </td>
                  <td className="px-2 py-1">
                    {!!q.failed && q.failed > 0 && (
                      <button onClick={() => retryFailed.mutate(q.name)} className="text-purple hover:underline">
                        Retry failed
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
