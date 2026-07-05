"use client";

import { useEffect, useState } from "react";
import { useMorningBriefingSettings, useUpdateMorningBriefingSettings } from "@/hooks/use-organization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  const { data: settings, isLoading } = useMorningBriefingSettings();
  const update = useUpdateMorningBriefingSettings();

  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("07:00");
  const [channel, setChannel] = useState("SMS");

  useEffect(() => {
    if (settings) {
      setEnabled(settings.morningBriefingEnabled);
      setTime(settings.morningBriefingTime);
      setChannel(settings.morningBriefingChannel);
    }
  }, [settings]);

  const onSave = () => {
    update.mutate({ morningBriefingEnabled: enabled, morningBriefingTime: time, morningBriefingChannel: channel });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-navy">Settings</h1>

      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-1 font-medium text-navy">Morning Briefing</h2>
        <p className="mb-4 text-sm text-gray-500">
          A daily summary of today's jobs, outstanding AR, clocked-in techs, pending bookings, and upcoming plan
          renewals, sent in your organization's timezone{settings?.timezone ? ` (${settings.timezone})` : ""}.
        </p>

        {isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Enable morning briefing
            </label>

            <div className="flex items-center gap-4">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Time</label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-32" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Channel</label>
                <select
                  className="h-10 rounded-md border border-gray-300 px-3 text-sm"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">Email</option>
                  <option value="PUSH">Push</option>
                </select>
              </div>
            </div>

            <Button onClick={onSave} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
            {update.isSuccess && <span className="ml-3 text-sm text-green-600">Saved.</span>}
          </div>
        )}
      </div>
    </div>
  );
}
