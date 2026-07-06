"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMorningBriefingSettings, useUpdateMorningBriefingSettings } from "@/hooks/use-organization";
import {
  useCreateBillingPortalSession,
  useOrganizationProfile,
  useUpdateOrganizationProfile,
  downloadAccountingCsv,
} from "@/hooks/use-organization-profile";
import {
  useInviteTeamMember,
  useRemoveTeamMember,
  useTeam,
  useUpdateTeamMemberRole,
} from "@/hooks/use-team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  const { data: currentUser } = useCurrentUser();
  const isOwner = currentUser?.role === "OWNER";
  const isManager = isOwner || currentUser?.role === "MANAGER";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-navy">Settings</h1>

      <CompanyProfileSection />
      <TaxInvoiceDefaultsSection />
      <BillingSection />
      <TeamSection isOwner={isOwner} isManager={isManager} />
      <MorningBriefingSection />
      <IntegrationsSection />
      <MoreSettingsLinksSection />
    </div>
  );
}

function CompanyProfileSection() {
  const { data: profile, isLoading } = useOrganizationProfile();
  const update = useUpdateOrganizationProfile();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? "",
        phone: profile.phone ?? "",
        email: profile.email ?? "",
        website: profile.website ?? "",
        address: profile.address ?? "",
        city: profile.city ?? "",
        state: profile.state ?? "",
        zip: profile.zip ?? "",
      });
    }
  }, [profile]);

  if (isLoading) return null;

  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="mb-4 font-medium text-navy">Company Profile</h2>
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input placeholder="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        <Input
          className="col-span-2"
          placeholder="Address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          <Input placeholder="Zip" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
        </div>
      </div>
      <Button className="mt-4" onClick={() => update.mutate(form)} disabled={update.isPending}>
        {update.isPending ? "Saving…" : "Save"}
      </Button>
      {update.isSuccess && <span className="ml-3 text-sm text-green-600">Saved.</span>}
    </div>
  );
}

function TaxInvoiceDefaultsSection() {
  const { data: profile, isLoading } = useOrganizationProfile();
  const update = useUpdateOrganizationProfile();

  const [taxRate, setTaxRate] = useState(0);
  const [terms, setTerms] = useState("");
  const [dueDays, setDueDays] = useState(30);

  useEffect(() => {
    if (profile) {
      setTaxRate(Number(profile.defaultTaxRate));
      setTerms(profile.defaultInvoiceTerms ?? "");
      setDueDays(profile.defaultInvoiceDueDays);
    }
  }, [profile]);

  if (isLoading) return null;

  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="mb-4 font-medium text-navy">Tax &amp; Invoice Defaults</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Default tax rate (%)</label>
          <Input type="number" step="0.01" min="0" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Default due days</label>
          <Input type="number" min="0" value={dueDays} onChange={(e) => setDueDays(Number(e.target.value))} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-gray-500">Default invoice terms</label>
          <textarea
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            rows={3}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
          />
        </div>
      </div>
      <Button
        className="mt-4"
        onClick={() =>
          update.mutate({ defaultTaxRate: taxRate, defaultInvoiceTerms: terms, defaultInvoiceDueDays: dueDays })
        }
        disabled={update.isPending}
      >
        {update.isPending ? "Saving…" : "Save"}
      </Button>
      {update.isSuccess && <span className="ml-3 text-sm text-green-600">Saved.</span>}
    </div>
  );
}

function BillingSection() {
  const { data: profile } = useOrganizationProfile();
  const createPortal = useCreateBillingPortalSession();
  const [error, setError] = useState<string | null>(null);

  const onOpenPortal = async () => {
    setError(null);
    const result = await createPortal.mutateAsync();
    if (result.url) {
      window.location.href = result.url;
    } else {
      setError("Billing portal isn't configured yet — contact support.");
    }
  };

  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="mb-1 font-medium text-navy">Billing</h2>
      <p className="mb-4 text-sm text-gray-500">
        Plan: <span className="font-medium text-gray-800">{profile?.subscriptionPlan}</span> · Status:{" "}
        <span className="font-medium text-gray-800">{profile?.subscriptionStatus}</span>
        {profile?.trialEndsAt && ` · Trial ends ${new Date(profile.trialEndsAt).toLocaleDateString()}`}
      </p>
      <Button variant="outline" onClick={onOpenPortal} disabled={createPortal.isPending}>
        {createPortal.isPending ? "Opening…" : "Manage Billing"}
      </Button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function TeamSection({ isOwner, isManager }: { isOwner: boolean; isManager: boolean }) {
  const { data, isLoading } = useTeam();
  const invite = useInviteTeamMember();
  const updateRole = useUpdateTeamMemberRole();
  const remove = useRemoveTeamMember();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [error, setError] = useState<string | null>(null);

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await invite.mutateAsync({ email, role });
      setEmail("");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Could not send invite.");
    }
  };

  if (isLoading) return null;

  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="mb-4 font-medium text-navy">Team</h2>

      {isManager && (
        <form onSubmit={onInvite} className="mb-4 flex gap-2">
          <Input
            className="flex-1"
            type="email"
            required
            placeholder="teammate@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            className="h-10 rounded-md border border-gray-300 px-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="TECHNICIAN">Technician</option>
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
          </select>
          <Button type="submit" disabled={invite.isPending}>
            Invite
          </Button>
        </form>
      )}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="divide-y">
        {data?.members.map((m) => (
          <div key={m.id} className="flex items-center justify-between py-2 text-sm">
            <div>
              <div className="font-medium text-gray-800">
                {m.firstName} {m.lastName} {m.isSuspended && <span className="text-xs text-red-500">(disabled)</span>}
              </div>
              <div className="text-xs text-gray-400">{m.email}</div>
            </div>
            <div className="flex items-center gap-2">
              {isOwner ? (
                <select
                  className="h-8 rounded-md border border-gray-300 px-2 text-xs"
                  value={m.role}
                  onChange={(e) => updateRole.mutate({ userId: m.id, role: e.target.value })}
                >
                  <option value="OWNER">Owner</option>
                  <option value="MANAGER">Manager</option>
                  <option value="EMPLOYEE">Employee</option>
                  <option value="TECHNICIAN">Technician</option>
                </select>
              ) : (
                <span className="text-xs text-gray-500">{m.role}</span>
              )}
              {isManager && m.role !== "OWNER" && !m.isSuspended && (
                <button
                  className="text-xs text-gray-400 hover:text-red-600"
                  onClick={() => remove.mutate(m.id)}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {data && data.pendingInvites.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="mb-2 text-xs font-medium uppercase text-gray-400">Pending Invites</p>
          {data.pendingInvites.map((i) => (
            <div key={i.id} className="flex justify-between py-1 text-sm text-gray-600">
              <span>{i.email}</span>
              <span className="text-xs text-gray-400">
                {i.role} · expires {new Date(i.expiresAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MorningBriefingSection() {
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
  );
}

function IntegrationsSection() {
  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="mb-1 font-medium text-navy">Accounting</h2>
      <p className="mb-4 text-sm text-gray-500">
        Export all invoices as a CSV for import into QuickBooks, Xero, or any other accounting software.
      </p>
      <Button variant="outline" onClick={() => downloadAccountingCsv()}>
        Export Invoices CSV
      </Button>
    </div>
  );
}

function MoreSettingsLinksSection() {
  const links = [
    { label: "Booking Settings", href: "/dashboard/booking/settings" },
    { label: "Price Book", href: "/dashboard/price-book" },
  ];
  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="mb-3 font-medium text-navy">More Settings</h2>
      <div className="flex flex-wrap gap-3">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="text-sm text-brand hover:underline">
            {link.label} →
          </Link>
        ))}
      </div>
    </div>
  );
}
