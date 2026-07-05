import { BadRequestException } from "@nestjs/common";

export interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxable?: boolean;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface ComputedTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
}

export function computeTotals(
  lineItems: LineItemInput[],
  taxRatePercent: number,
  discountAmount = 0,
): ComputedTotals {
  const subtotal = round2(lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0));
  const taxableSubtotal = round2(
    lineItems.filter((li) => li.taxable !== false).reduce((sum, li) => sum + li.quantity * li.unitPrice, 0),
  );
  const taxAmount = round2(taxableSubtotal * (taxRatePercent / 100));
  const total = round2(subtotal + taxAmount - discountAmount);
  return { subtotal, taxAmount, total };
}

const EPSILON = 0.01;

/**
 * S4 — server recomputes every total from line items and REJECTS the
 * request if a client-submitted subtotal/total doesn't match, rather than
 * silently overwriting it. A mismatch means the client (or an attacker)
 * is trying to make the UI and the charged amount disagree.
 */
export function computeAndVerifyTotals(
  lineItems: LineItemInput[],
  taxRatePercent: number,
  discountAmount: number,
  clientSubtotal?: number,
  clientTotal?: number,
): ComputedTotals {
  if (!lineItems || lineItems.length === 0) {
    throw new BadRequestException("At least one line item is required");
  }
  for (const li of lineItems) {
    if (li.quantity <= 0 || li.quantity > 999) {
      throw new BadRequestException(`Invalid quantity for "${li.description}"`);
    }
    if (li.unitPrice < 0) {
      throw new BadRequestException(`Invalid unit price for "${li.description}"`);
    }
  }

  const computed = computeTotals(lineItems, taxRatePercent, discountAmount);

  if (clientSubtotal !== undefined && Math.abs(clientSubtotal - computed.subtotal) > EPSILON) {
    throw new BadRequestException("Submitted subtotal does not match line items");
  }
  if (clientTotal !== undefined && Math.abs(clientTotal - computed.total) > EPSILON) {
    throw new BadRequestException("Submitted total does not match line items");
  }

  return computed;
}
