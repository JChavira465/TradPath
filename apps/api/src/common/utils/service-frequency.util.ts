import { ServiceFrequency } from "@tradpath/database";

/** Advances `from` by one cycle of the given frequency. Calendar-aware for
 * month-based frequencies (not a fixed day count) so "the 31st" behaves
 * sensibly across shorter months. */
export function advanceByFrequency(from: Date, frequency: ServiceFrequency): Date {
  const next = new Date(from);
  switch (frequency) {
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "BIWEEKLY":
      next.setDate(next.getDate() + 14);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      break;
    case "BIANNUAL":
      next.setMonth(next.getMonth() + 6);
      break;
    case "ANNUAL":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

export function billingPeriodFor(cycleStart: Date, billingCycle: "MONTHLY" | "ANNUAL"): { start: Date; end: Date } {
  const end = new Date(cycleStart);
  if (billingCycle === "MONTHLY") {
    end.setMonth(end.getMonth() + 1);
  } else {
    end.setFullYear(end.getFullYear() + 1);
  }
  return { start: cycleStart, end };
}
