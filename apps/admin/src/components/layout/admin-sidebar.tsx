"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { label: "Executive Dashboard", href: "/dashboard" },
  { label: "Companies", href: "/dashboard/companies" },
  { label: "Users", href: "/dashboard/users" },
  { label: "Billing", href: "/dashboard/billing" },
  { label: "Feature Flags", href: "/dashboard/feature-flags" },
  { label: "Audit Logs", href: "/dashboard/audit-logs" },
  { label: "System Health", href: "/dashboard/system-health" },
  { label: "Support Tickets", href: "/dashboard/support" },
  { label: "Announcements", href: "/dashboard/announcements" },
  { label: "Reports", href: "/dashboard/reports" },
  { label: "Customer Success", href: "/dashboard/customer-success" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-adminbg md:flex">
      <div className="flex h-16 items-center px-6 text-lg font-semibold text-purple">TradPath Admin</div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-md px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white",
                active && "bg-purple/20 text-white",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
