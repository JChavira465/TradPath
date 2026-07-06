// Platform's own subscription tiers (what an org pays TradPath), monthly
// pricing — distinct from ServicePlan pricing (what an org's own
// customers pay them). See pricing section of the product spec.
export const PLATFORM_PLAN_MONTHLY_PRICE: Record<string, number> = {
  STARTER: 49,
  GROWTH: 149,
  PRO: 299,
};
