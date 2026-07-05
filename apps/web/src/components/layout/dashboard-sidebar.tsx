"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Jobs", href: "/dashboard/jobs" },
  { label: "Schedule", href: "/dashboard/schedule" },
  { label: "Customers", href: "/dashboard/customers" },
  { label: "Estimates", href: "/dashboard/estimates" },
  { label: "Invoices", href: "/dashboard/invoices" },
  { label: "Service Plans", href: "/dashboard/service-plans" },
  { label: "Booking", href: "/dashboard/booking" },
  { label: "Price Book", href: "/dashboard/price-book" },
  { label: "Messages", href: "/dashboard/messages" },
  { label: "Time Tracking", href: "/dashboard/time-tracking" },
  { label: "Photos", href: "/dashboard/photos" },
  { label: "Reports", href: "/dashboard/reports" },
  { label: "Settings", href: "/dashboard/settings" },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-navy text-white md:flex">
      <div className="flex h-16 items-center px-6 text-lg font-semibold">TradPath</div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-navy-light hover:text-white",
                active && "bg-navy-light text-white",
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
