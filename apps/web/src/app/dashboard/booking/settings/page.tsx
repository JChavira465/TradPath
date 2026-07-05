"use client";

import { useEffect, useState } from "react";
import {
  useAddAvailability,
  useAddBlackout,
  useBookableServices,
  useBookingAvailability,
  useBookingBlackouts,
  useBookingSettings,
  usePlanTemplates,
  useRemoveAvailability,
  useRemoveBlackout,
  useSetPlanPublic,
  useSetServiceBookable,
  useUpdateBookingSettings,
} from "@/hooks/use-booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function BookingSettingsPage() {
  const { data: settings } = useBookingSettings();
  const updateSettings = useUpdateBookingSettings();
  const { data: availability } = useBookingAvailability();
  const addAvailability = useAddAvailability();
  const removeAvailability = useRemoveAvailability();
  const { data: blackouts } = useBookingBlackouts();
  const addBlackout = useAddBlackout();
  const removeBlackout = useRemoveBlackout();
  const { data: offerings } = useBookableServices();
  const setServiceBookable = useSetServiceBookable();
  const { data: planTemplates } = usePlanTemplates();
  const setPlanPublic = useSetPlanPublic();

  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [bookingSlug, setBookingSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#1B2A4A");
  const [saved, setSaved] = useState(false);

  const [newDay, setNewDay] = useState(1);
  const [newStart, setNewStart] = useState("08:00");
  const [newEnd, setNewEnd] = useState("17:00");
  const [blackoutDate, setBlackoutDate] = useState("");

  useEffect(() => {
    if (settings) {
      setBookingEnabled(settings.bookingEnabled);
      setBookingSlug(settings.bookingSlug ?? "");
      setTitle(settings.bookingPageTitle ?? "");
      setDescription(settings.bookingPageDescription ?? "");
      setColor(settings.bookingPageColor ?? "#1B2A4A");
    }
  }, [settings]);

  const publicUrl = typeof window !== "undefined" && bookingSlug ? `${window.location.origin}/book/${bookingSlug}` : "";

  const onSaveSettings = async () => {
    setSaved(false);
    await updateSettings.mutateAsync({
      bookingEnabled,
      bookingSlug: bookingSlug || undefined,
      bookingPageTitle: title || undefined,
      bookingPageDescription: description || undefined,
      bookingPageColor: color,
    });
    setSaved(true);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-navy">Booking Settings</h1>

      <div className="rounded-lg border bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="font-medium text-navy">Enable booking page</div>
            <div className="text-sm text-gray-500">Turn your public booking link on or off</div>
          </div>
          <input type="checkbox" checked={bookingEnabled} onChange={(e) => setBookingEnabled(e.target.checked)} className="h-5 w-5" />
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Booking link slug</label>
            <Input value={bookingSlug} onChange={(e) => setBookingSlug(e.target.value)} placeholder="your-company-name" />
            {publicUrl && (
              <p className="mt-1 text-xs text-gray-500">
                {publicUrl}{" "}
                <button type="button" className="text-brand underline" onClick={() => navigator.clipboard.writeText(publicUrl)}>
                  Copy link
                </button>
              </p>
            )}
          </div>
          <Input placeholder="Page title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            rows={2}
            placeholder="Page description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Brand color</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={onSaveSettings} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? "Saving…" : "Save Settings"}
          </Button>
          {saved && <span className="text-sm text-green-600">Saved.</span>}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-3 font-medium text-navy">Weekly Availability</h2>
        <div className="space-y-2">
          {availability?.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
              <span>
                {DAYS[a.dayOfWeek]}: {a.startTime} – {a.endTime}
              </span>
              <button onClick={() => removeAvailability.mutate(a.id)} className="text-xs text-gray-400 hover:text-red-600">
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <select className="h-9 rounded-md border border-gray-300 px-2 text-sm" value={newDay} onChange={(e) => setNewDay(Number(e.target.value))}>
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
          <input type="time" className="h-9 rounded-md border border-gray-300 px-2 text-sm" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
          <input type="time" className="h-9 rounded-md border border-gray-300 px-2 text-sm" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
          <Button
            variant="outline"
            onClick={() => addAvailability.mutate({ dayOfWeek: newDay, startTime: newStart, endTime: newEnd })}
          >
            + Add
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-3 font-medium text-navy">Blackout Dates</h2>
        <div className="space-y-2">
          {blackouts?.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
              <span>
                {new Date(b.date).toLocaleDateString()} {b.reason && `— ${b.reason}`}
              </span>
              <button onClick={() => removeBlackout.mutate(b.id)} className="text-xs text-gray-400 hover:text-red-600">
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="date"
            className="h-9 rounded-md border border-gray-300 px-2 text-sm"
            value={blackoutDate}
            onChange={(e) => setBlackoutDate(e.target.value)}
          />
          <Button variant="outline" onClick={() => blackoutDate && addBlackout.mutate({ date: blackoutDate })}>
            + Add
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-3 font-medium text-navy">Bookable Services</h2>
        <p className="mb-3 text-sm text-gray-500">Choose which services show up on your public booking page.</p>
        <div className="space-y-2">
          {offerings?.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
              <span>{o.name}</span>
              <input
                type="checkbox"
                checked={o.isBookable}
                onChange={(e) => setServiceBookable.mutate({ id: o.id, isBookable: e.target.checked })}
                className="h-5 w-5"
              />
            </div>
          ))}
          {offerings?.length === 0 && <p className="text-sm text-gray-400">No services set up yet.</p>}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-3 font-medium text-navy">Public Service Plans</h2>
        <p className="mb-3 text-sm text-gray-500">
          Make an existing plan visible on your booking page as a subscribable offering (needs a public name set on
          the plan first).
        </p>
        <div className="space-y-2">
          {planTemplates?.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
              <span>
                {p.name} {p.publicName && <span className="text-gray-400">({p.publicName})</span>}
              </span>
              <input
                type="checkbox"
                checked={p.isPublic}
                disabled={!p.publicName && !p.isPublic}
                onChange={(e) => setPlanPublic.mutate({ id: p.id, isPublic: e.target.checked })}
                className="h-5 w-5"
              />
            </div>
          ))}
          {planTemplates?.length === 0 && <p className="text-sm text-gray-400">No service plans yet.</p>}
        </div>
      </div>
    </div>
  );
}
