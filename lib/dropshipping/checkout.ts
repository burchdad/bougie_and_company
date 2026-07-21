import type { DropshipShippingMode } from "./config";

export type DropshipShippingLine = {
  quantity: number;
  shippingCost: number;
};

function money(value: number) {
  return Number(value.toFixed(2));
}

export function calculateDropshipShippingTotal(lines: DropshipShippingLine[], mode: DropshipShippingMode, flatRate = 0) {
  if (!lines.length || mode === "included") {
    return 0;
  }

  if (mode === "flat") {
    return money(Math.max(0, flatRate));
  }

  if (mode === "highest_item") {
    return money(Math.max(...lines.map((line) => Number(line.shippingCost || 0)), 0));
  }

  return money(lines.reduce((sum, line) => sum + Number(line.shippingCost || 0) * Math.max(0, Math.trunc(Number(line.quantity || 0))), 0));
}

