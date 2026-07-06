"use client";

import { useState } from "react";
import {
  useAdminUserLoginHistory,
  useAdminUserSessions,
  useAdminUsersList,
  useDisableUser,
  useEnableUser,
  useForceResetPassword,
  useRevokeUserSessions,
  useUnlockUser,
} from "@/hooks/use-admin-users";

function UserDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: history } = useAdminUserLoginHistory(id);
  const { data: sessions } = useAdminUserSessions(id);
  const forceReset = useForceResetPassword();
  const unlock = useUnlockUser();
  const disable = useDisableUser();
  const enable = useEnableUser();
  const revokeSessions = useRevokeUserSessions();

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">User detail</h2>
        <button onClick={onClose} className="text-sm text-white/50 hover:text-white">
          Close
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => forceReset.mutate(id)} className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/80 hover:bg-white/20">
          Force password reset
        </button>
        <button onClick={() => unlock.mutate(id)} className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/80 hover:bg-white/20">
          Unlock
        </button>
        <button onClick={() => disable.mutate(id)} className="rounded-md bg-yellow-600/20 px-3 py-1.5 text-sm text-yellow-300 hover:bg-yellow-600/30">
          Disable
        </button>
        <button onClick={() => enable.mutate(id)} className="rounded-md bg-green-600/20 px-3 py-1.5 text-sm text-green-300 hover:bg-green-600/30">
          Enable
        </button>
        <button
          onClick={() => revokeSessions.mutate(id)}
          className="rounded-md bg-red-600/20 px-3 py-1.5 text-sm text-red-300 hover:bg-red-600/30"
        >
          Revoke all sessions
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium text-white">Active sessions</h3>
          <div className="space-y-1 text-xs text-white/60">
            {(sessions ?? []).map((s) => (
              <div key={s.id} className="rounded border border-white/10 p-2">
                {s.platform} — {s.ipAddress ?? "unknown IP"} — {new Date(s.createdAt).toLocaleString()}
              </div>
            ))}
            {sessions?.length === 0 && <p className="text-white/40">No active sessions.</p>}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-white">Login history</h3>
          <div className="max-h-64 space-y-1 overflow-y-auto text-xs text-white/60">
            {(history ?? []).slice(0, 20).map((s) => (
              <div key={s.id} className="rounded border border-white/10 p-2">
                {s.platform} — {s.ipAddress ?? "unknown IP"} — {new Date(s.createdAt).toLocaleString()}
                {s.revokedAt && <span className="ml-2 text-red-400">revoked</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UserManagementPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading } = useAdminUsersList(search);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">User Management</h1>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
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
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Org</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Last login</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-t border-white/10 text-white/80">
                  <td className="px-3 py-2">
                    {u.firstName} {u.lastName}
                    {u.isSuspended && <span className="ml-2 text-xs text-yellow-400">disabled</span>}
                    {u.isSuperAdmin && <span className="ml-2 text-xs text-purple">super admin</span>}
                  </td>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">{u.organization.name}</td>
                  <td className="px-3 py-2">{u.role}</td>
                  <td className="px-3 py-2">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => setSelectedId(u.id)} className="text-purple hover:underline">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && <UserDetailPanel id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
