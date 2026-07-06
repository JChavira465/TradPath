"use client";

import { useState } from "react";
import { useAnnouncements, useCreateAnnouncement, useDeleteAnnouncement } from "@/hooks/use-admin-announcements";

export default function AnnouncementsPage() {
  const { data, isLoading } = useAnnouncements();
  const createAnnouncement = useCreateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Announcements</h1>

      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="mb-2 font-medium text-white">New announcement</h2>
        <div className="space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-md border border-white/10 bg-adminbg px-3 py-2 text-sm text-white"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message"
            rows={3}
            className="w-full rounded-md border border-white/10 bg-adminbg px-3 py-2 text-sm text-white"
          />
          <button
            disabled={!title || !message}
            onClick={() => {
              createAnnouncement.mutate({ title, message });
              setTitle("");
              setMessage("");
            }}
            className="rounded-md bg-purple/20 px-3 py-1.5 text-sm text-purple-200 hover:bg-purple/30 disabled:opacity-40"
          >
            Publish
          </button>
        </div>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-white/60">Loading…</p>
      ) : (
        <div className="space-y-2">
          {data.map((a) => (
            <div key={a.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium text-white">{a.title}</div>
                <button onClick={() => deleteAnnouncement.mutate(a.id)} className="text-sm text-red-400 hover:underline">
                  Delete
                </button>
              </div>
              <p className="mt-1 text-sm text-white/70">{a.message}</p>
              <div className="mt-1 text-xs text-white/40">{new Date(a.createdAt).toLocaleString()}</div>
            </div>
          ))}
          {data.length === 0 && <p className="text-sm text-white/40">No announcements yet.</p>}
        </div>
      )}
    </div>
  );
}
