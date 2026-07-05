/**
 * Shared "find the last number for this org, add one" pattern used for
 * job/invoice/estimate numbers. Not a true atomic counter by itself (a
 * genuine race is possible under concurrent creates reading the same
 * "last" row) — pair it with withRetryOnCollision so a collision at the
 * DB's unique(organizationId, number) constraint re-derives a fresh
 * number and retries, rather than surfacing as a client-facing error.
 */
export async function nextSequentialNumber(
  findLast: () => Promise<{ number: string } | null>,
  startAt = 1001,
): Promise<string> {
  const last = await findLast();
  const next = last ? (parseInt(last.number, 10) || startAt - 1) + 1 : startAt;
  return String(next);
}

/**
 * Retries `attempt` on a Prisma unique-constraint violation (P2002),
 * re-running it from scratch each time so a fresh sequential number is
 * derived — this is what actually makes number allocation transaction-safe
 * under concurrent creates, rather than just failing on the first collision.
 */
export async function withRetryOnCollision<T>(attempt: () => Promise<T>, maxAttempts = 5): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await attempt();
    } catch (err: any) {
      if (err?.code === "P2002") {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
