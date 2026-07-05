"use client";

import { useState } from "react";
import Link from "next/link";
import { useCustomers } from "@/hooks/use-customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const { data: customers, isLoading } = useCustomers(search || undefined);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Customers</h1>
        <Link href="/dashboard/customers/new">
          <Button>New Customer</Button>
        </Link>
      </div>

      <Input
        placeholder="Search by name, company, email, phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-sm"
      />

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {customers?.map((c) => (
                <tr key={c.id} className="cursor-pointer hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/customers/${c.id}`} className="font-medium text-navy">
                      {c.firstName} {c.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.company ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {Number(c.outstandingBalance) > 0 ? (
                      <span className="font-medium text-red-600">${c.outstandingBalance}</span>
                    ) : (
                      "$0"
                    )}
                  </td>
                </tr>
              ))}
              {customers?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No customers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
