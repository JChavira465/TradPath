"use client";

import { useState } from "react";
import {
  useCreateFlag,
  useDeleteFlag,
  useFeatureFlags,
  useFlagOverrides,
  useRemoveOverride,
  useSetOverride,
  useToggleFlagDefault,
} from "@/hooks/use-admin-feature-flags";

function OverridesPanel({ flagKey }: { flagKey: string }) {
  const { data: overrides } = useFlagOverrides(flagKey);
  const setOverride = useSetOverride();
  const removeOverride = useRemoveOverride();
  const [orgId, setOrgId] = useState("");

  return (
    <div className="mt-2 rounded-md border border-white/10 bg-adminbg p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          placeholder="Organization ID"
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
        />
        <button
          disabled={!orgId}
          onClick={() => setOverride.mutate({ key: flagKey, organizationId: orgId, enabled: true })}
          className="rounded-md bg-green-600/20 px-2 py-1 text-xs text-green-300 hover:bg-green-600/30 disabled:opacity-40"
        >
          Enable for org
        </button>
        <button
          disabled={!orgId}
          onClick={() => setOverride.mutate({ key: flagKey, organizationId: orgId, enabled: false })}
          className="rounded-md bg-yellow-600/20 px-2 py-1 text-xs text-yellow-300 hover:bg-yellow-600/30 disabled:opacity-40"
        >
          Disable for org
        </button>
      </div>
      <div className="space-y-1 text-xs text-white/60">
        {overrides?.map((o) => (
          <div key={o.id} className="flex items-center justify-between">
            <span>
              {o.organization.name} — {o.enabled ? "enabled" : "disabled"}
            </span>
            <button
              onClick={() => removeOverride.mutate({ key: flagKey, organizationId: o.organizationId })}
              className="text-red-400 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
        {overrides?.length === 0 && <p className="text-white/40">No overrides.</p>}
      </div>
    </div>
  );
}

export default function FeatureFlagsPage() {
  const { data: flags, isLoading } = useFeatureFlags();
  const createFlag = useCreateFlag();
  const toggleDefault = useToggleFlagDefault();
  const deleteFlag = useDeleteFlag();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Feature Flags</h1>

      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="mb-2 font-medium text-white">New flag</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="flag_key"
            className="rounded-md border border-white/10 bg-adminbg px-2 py-1 text-sm text-white"
          />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label"
            className="rounded-md border border-white/10 bg-adminbg px-2 py-1 text-sm text-white"
          />
          <button
            disabled={!newKey || !newLabel}
            onClick={() => {
              createFlag.mutate({ key: newKey, label: newLabel });
              setNewKey("");
              setNewLabel("");
            }}
            className="rounded-md bg-purple/20 px-3 py-1.5 text-sm text-purple-200 hover:bg-purple/30 disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-white/60">Loading…</p>
      ) : (
        <div className="space-y-2">
          {flags?.map((flag) => (
            <div key={flag.key} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">{flag.label}</div>
                  <div className="text-xs text-white/50">{flag.key}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={flag.defaultEnabled}
                      onChange={(e) => toggleDefault.mutate({ key: flag.key, defaultEnabled: e.target.checked })}
                    />
                    Default on
                  </label>
                  <button
                    onClick={() => setExpandedKey(expandedKey === flag.key ? null : flag.key)}
                    className="text-sm text-purple hover:underline"
                  >
                    Overrides
                  </button>
                  <button onClick={() => deleteFlag.mutate(flag.key)} className="text-sm text-red-400 hover:underline">
                    Delete
                  </button>
                </div>
              </div>
              {expandedKey === flag.key && <OverridesPanel flagKey={flag.key} />}
            </div>
          ))}
          {flags?.length === 0 && <p className="text-sm text-white/40">No feature flags yet.</p>}
        </div>
      )}
    </div>
  );
}
