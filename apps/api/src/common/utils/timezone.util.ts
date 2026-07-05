/** Current local hour (0-23) in the given IANA timezone. */
export function localHourIn(timezone: string): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  // "24" shows up for midnight in some locales/environments — normalize.
  return Number(formatted) % 24;
}

/** Start of "today" (local midnight) in the given IANA timezone, as a UTC Date. */
export function startOfLocalDay(timezone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}
