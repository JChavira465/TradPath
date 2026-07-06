"use client";

import { useState } from "react";
import {
  useAdminCompanies,
  useAdminCompanyDetail,
  useArchiveCompany,
  useDeleteCompany,
  useImpersonate,
  useReactivateCompany,
  useResetTrial,
  useSuspendCompany,
  useTransferOwnership,
  downloadCompaniesCsv,
} from "@/hooks/use-admin-companies";

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";

function CompanyDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: company, isLoading } = useAdminCompanyDetail(id);
  const suspend = useSuspendCompany();
  const reactivate = useReactivateCompany();
  const archive = useArchiveCompany();
  const remove = useDeleteCompany();
  const resetTrial = useResetTrial();
  const transferOwnership = useTransferOwnership();
  const impersonate = useImpersonate();

  const [confirmText, setConfirmText] = useState("");
  const [transferTarget, setTransferTarget] = useState("");
  const [impersonateTarget, setImpersonateTarget] = useState("");
  const [readOnly, setReadOnly] = useState(true);

  if (isLoading || !company) {
    return <p className="text-sm text-white/60">Loading…</p>;
  }

  const startImpersonation = async () => {
    if (!impersonateTarget) return;
    const result = await impersonate.mutateAsync({ userId: impersonateTarget, readOnly });
    window.open(`${WEB_URL}/dashboard?impersonate_token=${encodeURIComponent(result.accessToken)}`, "_blank");
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{company.name}</h2>
        <button onClick={onClose} className="text-sm text-white/50 hover:text-white">
          Close
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm text-white/70 md:grid-cols-4">
        <div>Slug: {company.slug}</div>
        <div>Plan: {company.subscriptionPlan}</div>
        <div>Status: {company.subscriptionStatus}</div>
        <div>Health: {company.healthScore ?? "—"}</div>
        <div>Users: {company._count.users}</div>
        <div>Jobs: {company._count.jobs}</div>
        <div>Invoices: {company._count.invoices}</div>
        <div>Storage: {(company.storageUsedBytes / 1_000_000).toFixed(1)} MB</div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {company.isSuspended ? (
          <button
            onClick={() => reactivate.mutate(company.id)}
            className="rounded-md bg-green-600/20 px-3 py-1.5 text-sm text-green-300 hover:bg-green-600/30"
          >
            Reactivate
          </button>
        ) : (
          <button
            onClick={() => suspend.mutate(company.id)}
            className="rounded-md bg-yellow-600/20 px-3 py-1.5 text-sm text-yellow-300 hover:bg-yellow-600/30"
          >
            Suspend
          </button>
        )}
        <button
          onClick={() => resetTrial.mutate({ id: company.id, days: 14 })}
          className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/80 hover:bg-white/20"
        >
          Reset trial (+14d)
        </button>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <h3 className="mb-2 text-sm font-medium text-white">Team</h3>
        <div className="space-y-1 text-sm text-white/70">
          {company.users.map((u) => (
            <div key={u.id} className="flex items-center justify-between">
              <span>
                {u.firstName} {u.lastName} ({u.email}) — {u.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <h3 className="mb-2 text-sm font-medium text-white">Transfer ownership</h3>
        <div className="flex gap-2">
          <select
            value={transferTarget}
            onChange={(e) => setTransferTarget(e.target.value)}
            className="rounded-md border border-white/10 bg-adminbg px-2 py-1 text-sm text-white"
          >
            <option value="">Select user…</option>
            {company.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
          <button
            disabled={!transferTarget}
            onClick={() => transferOwnership.mutate({ id: company.id, newOwnerUserId: transferTarget })}
            className="rounded-md bg-purple/20 px-3 py-1.5 text-sm text-purple-200 hover:bg-purple/30 disabled:opacity-40"
          >
            Transfer
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <h3 className="mb-2 text-sm font-medium text-white">Impersonate</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={impersonateTarget}
            onChange={(e) => setImpersonateTarget(e.target.value)}
            className="rounded-md border border-white/10 bg-adminbg px-2 py-1 text-sm text-white"
          >
            <option value="">Select user…</option>
            {company.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-sm text-white/70">
            <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
            Read-only
          </label>
          <button
            disabled={!impersonateTarget}
            onClick={startImpersonation}
            className="rounded-md bg-purple/20 px-3 py-1.5 text-sm text-purple-200 hover:bg-purple/30 disabled:opacity-40"
          >
            Start impersonation
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <h3 className="mb-2 text-sm font-medium text-red-300">Destructive actions</h3>
        <p className="mb-2 text-xs text-white/50">
          Type the company&apos;s slug (<code>{company.slug}</code>) to confirm archive or delete.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="confirm slug"
            className="rounded-md border border-white/10 bg-adminbg px-2 py-1 text-sm text-white"
          />
          <button
            disabled={confirmText !== company.slug}
            onClick={() => archive.mutate({ id: company.id, confirmSlug: confirmText })}
            className="rounded-md bg-red-600/20 px-3 py-1.5 text-sm text-red-300 hover:bg-red-600/30 disabled:opacity-40"
          >
            Archive
          </button>
          <button
            disabled={confirmText !== company.slug}
            onClick={() => {
              remove.mutate({ id: company.id, confirmSlug: confirmText });
              onClose();
            }}
            className="rounded-md bg-red-600/30 px-3 py-1.5 text-sm text-red-200 hover:bg-red-600/40 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CompanyManagementPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading } = useAdminCompanies(search);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Company Management</h1>
        <button
          onClick={() => downloadCompaniesCsv(search)}
          className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/80 hover:bg-white/20"
        >
          Export CSV
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, slug, or email…"
        className="w-full max-w-sm rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
      />

      {isLoading || !data ? (
        <p className="text-sm text-white/60">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-white/50">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Users</th>
                <th className="px-3 py-2">Jobs</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.companies.map((c) => (
                <tr key={c.id} className="border-t border-white/10 text-white/80">
                  <td className="px-3 py-2">
                    {c.name}
                    {c.isSuspended && <span className="ml-2 text-xs text-yellow-400">suspended</span>}
                    {c.isArchived && <span className="ml-2 text-xs text-red-400">archived</span>}
                  </td>
                  <td className="px-3 py-2">{c.subscriptionPlan}</td>
                  <td className="px-3 py-2">{c.subscriptionStatus}</td>
                  <td className="px-3 py-2">{c._count.users}</td>
                  <td className="px-3 py-2">{c._count.jobs}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => setSelectedId(c.id)} className="text-purple hover:underline">
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {data.companies.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-white/40">
                    No companies found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && <CompanyDetailPanel id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
