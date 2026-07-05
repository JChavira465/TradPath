"use client";

import { useState } from "react";
import { useCustomers } from "@/hooks/use-customers";
import {
  useCreateMessageTemplate,
  useDeleteMessageTemplate,
  useMessages,
  useMessageTemplates,
  useProvisionNumber,
  useSendMessage,
} from "@/hooks/use-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function MessagesPage() {
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  const { data: customers } = useCustomers(search || undefined);
  const { data: messages, isLoading: messagesLoading } = useMessages(selectedCustomerId ?? undefined);
  const sendMessage = useSendMessage();
  const provisionNumber = useProvisionNumber();
  const { data: templates } = useMessageTemplates();
  const createTemplate = useCreateMessageTemplate();
  const deleteTemplate = useDeleteMessageTemplate();

  const [templateName, setTemplateName] = useState("");
  const [templateBody, setTemplateBody] = useState("");

  const selectedCustomer = customers?.find((c) => c.id === selectedCustomerId);

  const onSend = async () => {
    if (!selectedCustomerId || !draft.trim()) return;
    await sendMessage.mutateAsync({ customerId: selectedCustomerId, body: draft.trim() });
    setDraft("");
  };

  const onCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTemplate.mutateAsync({ name: templateName, body: templateBody });
    setTemplateName("");
    setTemplateBody("");
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Messages</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTemplates((v) => !v)}>
            Templates
          </Button>
          <Button
            variant="outline"
            disabled={provisionNumber.isPending}
            onClick={() => provisionNumber.mutate()}
          >
            {provisionNumber.isPending ? "Provisioning…" : "Provision Texting Number"}
          </Button>
        </div>
      </div>

      {provisionNumber.data && (
        <div className="mb-4 rounded-md border bg-blue-50 p-3 text-sm text-blue-700">
          {provisionNumber.data.phoneNumber
            ? provisionNumber.data.provisioned
              ? `Provisioned ${provisionNumber.data.phoneNumber} for texting.`
              : `Already using ${provisionNumber.data.phoneNumber} for texting.`
            : "No Twilio number could be provisioned. Check your Twilio account/credentials."}
        </div>
      )}

      {showTemplates && (
        <div className="mb-6 rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-medium text-navy">Message Templates</h2>
          <form onSubmit={onCreateTemplate} className="mb-4 grid grid-cols-4 gap-2">
            <Input placeholder="Name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required />
            <Input
              className="col-span-2"
              placeholder="Message body"
              value={templateBody}
              onChange={(e) => setTemplateBody(e.target.value)}
              required
            />
            <Button type="submit" disabled={createTemplate.isPending}>
              Add Template
            </Button>
          </form>
          <div className="space-y-2">
            {templates?.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <div>
                  <span className="font-medium text-gray-800">{t.name}</span>
                  <span className="ml-2 text-gray-500">{t.body}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setDraft(t.body)}
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    className="text-xs text-gray-400 hover:text-red-600"
                    onClick={() => deleteTemplate.mutate(t.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {templates?.length === 0 && <p className="text-sm text-gray-400">No templates yet.</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3" style={{ minHeight: 500 }}>
        <div className="rounded-lg border bg-white md:col-span-1">
          <div className="border-b p-3">
            <Input placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {customers?.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCustomerId(c.id)}
                className={`block w-full border-b p-3 text-left text-sm hover:bg-gray-50 ${
                  selectedCustomerId === c.id ? "bg-blue-50" : ""
                }`}
              >
                <div className="font-medium text-gray-800">
                  {c.firstName} {c.lastName}
                </div>
                <div className="text-xs text-gray-400">{c.phone ?? "No phone on file"}</div>
              </button>
            ))}
            {customers?.length === 0 && <p className="p-3 text-sm text-gray-400">No customers found.</p>}
          </div>
        </div>

        <div className="flex flex-col rounded-lg border bg-white md:col-span-2">
          {!selectedCustomerId ? (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
              Select a customer to view messages
            </div>
          ) : (
            <>
              <div className="border-b p-3">
                <div className="font-medium text-navy">
                  {selectedCustomer?.firstName} {selectedCustomer?.lastName}
                </div>
                <div className="text-xs text-gray-400">{selectedCustomer?.phone ?? "No phone on file"}</div>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: 440 }}>
                {messagesLoading && <p className="text-sm text-gray-400">Loading…</p>}
                {messages?.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                        m.direction === "OUTBOUND" ? "bg-navy text-white" : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {m.body}
                      <div className={`mt-1 text-[10px] ${m.direction === "OUTBOUND" ? "text-gray-300" : "text-gray-400"}`}>
                        {new Date(m.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
                {messages?.length === 0 && <p className="text-sm text-gray-400">No messages yet.</p>}
              </div>
              <div className="flex gap-2 border-t p-3">
                <Input
                  placeholder="Type a message…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSend();
                  }}
                />
                <Button onClick={onSend} disabled={sendMessage.isPending || !draft.trim()}>
                  Send
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
