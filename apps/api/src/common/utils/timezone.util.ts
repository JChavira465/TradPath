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
  return startOfLocalDayFor(new Date(), timezone);
}

/** Start of the local calendar day containing `date`, in the given IANA timezone. */
export function startOfLocalDayFor(date: Date, timezone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

/** Start of the local (Sunday-start) week containing `date`, in the given IANA timezone. */
export function startOfLocalWeekFor(date: Date, timezone: string): Date {
  const dayStart = startOfLocalDayFor(date, timezone);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(date);
  const idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  return new Date(dayStart.getTime() - idx * 24 * 60 * 60 * 1000);
}
