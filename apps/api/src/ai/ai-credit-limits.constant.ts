// S10 — Growth gets a metered monthly allowance, Pro is unlimited, Starter
// has no AI access at all (voice-to-invoice is a paid-tier feature).
// Shared between AiService (enforcement) and reporting (usage display).
export const AI_CREDIT_LIMITS: Record<string, number> = {
  STARTER: 0,
  GROWTH: 50,
  PRO: Infinity,
};
