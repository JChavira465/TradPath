"use client";

import type { LineItem } from "@tradpath/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LineItemsEditorProps {
  lineItems: LineItem[];
  onChange: (items: LineItem[]) => void;
  taxRate: number;
  discountAmount: number;
}

export function computeLocalTotals(lineItems: LineItem[], taxRate: number, discountAmount: number) {
  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const taxableSubtotal = lineItems
    .filter((li) => li.taxable !== false)
    .reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const taxAmount = taxableSubtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discountAmount;
  return { subtotal, taxAmount, total };
}

export function LineItemsEditor({ lineItems, onChange, taxRate, discountAmount }: LineItemsEditorProps) {
  const update = (index: number, patch: Partial<LineItem>) => {
    onChange(lineItems.map((li, i) => (i === index ? { ...li, ...patch } : li)));
  };
  const remove = (index: number) => onChange(lineItems.filter((_, i) => i !== index));
  const add = () => onChange([...lineItems, { description: "", quantity: 1, unitPrice: 0, taxable: true }]);

  const totals = computeLocalTotals(lineItems, taxRate, discountAmount);

  return (
    <div>
      <div className="space-y-2">
        {lineItems.map((li, i) => (
          <div key={i} className="grid grid-cols-12 items-center gap-2">
            <Input
              className="col-span-6"
              placeholder="Description"
              value={li.description}
              onChange={(e) => update(i, { description: e.target.value })}
            />
            <Input
              className="col-span-2"
              type="number"
              min="0.01"
              step="1"
              placeholder="Qty"
              value={li.quantity}
              onChange={(e) => update(i, { quantity: Number(e.target.value) })}
            />
            <Input
              className="col-span-3"
              type="number"
              min="0"
              step="0.01"
              placeholder="Unit price"
              value={li.unitPrice}
              onChange={(e) => update(i, { unitPrice: Number(e.target.value) })}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="col-span-1 text-xs text-gray-400 hover:text-red-600"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" className="mt-2" onClick={add}>
        + Add line item
      </Button>

      <div className="mt-4 space-y-1 border-t pt-3 text-sm">
        <div className="flex justify-between text-gray-500">
          <span>Subtotal</span>
          <span>${totals.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Tax ({taxRate}%)</span>
          <span>${totals.taxAmount.toFixed(2)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-gray-500">
            <span>Discount</span>
            <span>-${discountAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-semibold text-navy">
          <span>Total</span>
          <span>${totals.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
