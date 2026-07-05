import { cn } from "@/lib/cn";

const STYLES: Record<string, string> = {
  DRAFT: "bg-gray-200 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  VIEWED: "bg-indigo-100 text-indigo-700",
  APPROVED: "bg-green-100 text-green-700",
  DECLINED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-200 text-gray-500",
  CONVERTED: "bg-purple-100 text-purple-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  VOID: "bg-gray-200 text-gray-500",
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-red-100 text-red-700",
  PENDING: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-green-100 text-green-700",
};

export function InvoicingStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", STYLES[status] ?? "bg-gray-100 text-gray-600")}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
