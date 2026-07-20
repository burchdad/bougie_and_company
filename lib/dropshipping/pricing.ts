import type { MarkupType } from "./types";

type PriceInput = {
  wholesalePrice?: number | null;
  shippingCost?: number | null;
  suggestedRetailPrice?: number | null;
  markupType?: MarkupType | null;
  markupValue?: number | null;
  priceOverride?: number | null;
};

function cleanNumber(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function nonNegativeNumber(value: number | null | undefined) {
  const parsed = cleanNumber(value);
  return parsed !== null && parsed > 0 ? parsed : 0;
}

function roundToNinetyNine(value: number) {
  if (value <= 0) {
    return 0;
  }

  const dollars = Math.floor(value);
  const rounded = dollars + 0.99;
  return Number((rounded < value ? dollars + 1.99 : rounded).toFixed(2));
}

export function calculateDropshipRetailPrice(input: PriceInput) {
  const wholesalePrice = nonNegativeNumber(input.wholesalePrice);
  const shippingCost = nonNegativeNumber(input.shippingCost);
  const suggestedRetailPrice = cleanNumber(input.suggestedRetailPrice);
  const markupValue = nonNegativeNumber(input.markupValue);
  const priceOverride = cleanNumber(input.priceOverride);
  const floor = wholesalePrice + shippingCost;
  let retail: number;

  if (priceOverride !== null && priceOverride > 0) {
    retail = priceOverride;
  } else if (input.markupType === "percentage") {
    retail = floor * (1 + markupValue / 100);
  } else if (input.markupType === "fixed") {
    retail = floor + markupValue;
  } else if (suggestedRetailPrice !== null && suggestedRetailPrice > 0) {
    retail = suggestedRetailPrice;
  } else {
    retail = floor;
  }

  return roundToNinetyNine(Math.max(retail, floor));
}
