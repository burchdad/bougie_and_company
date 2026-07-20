import { CommerceError } from "../core/errors";
import type { CommercePriceInput, CommercePriceResult } from "../core/types";
import { roundToNinetyNine } from "./rounding";

function cleanNumber(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function nonNegativeNumber(value: number | null | undefined) {
  const parsed = cleanNumber(value);
  return parsed !== null && parsed > 0 ? parsed : 0;
}

export function calculateCommerceRetailPrice(input: CommercePriceInput): CommercePriceResult {
  const wholesalePrice = nonNegativeNumber(input.wholesalePrice);
  const shippingCost = nonNegativeNumber(input.shippingCost);
  const suggestedRetailPrice = cleanNumber(input.suggestedRetailPrice);
  const markupValue = nonNegativeNumber(input.markupValue);
  const priceOverride = cleanNumber(input.priceOverride);
  const floorPrice = wholesalePrice + shippingCost;
  let retailPrice: number;
  let source: CommercePriceResult["source"];

  if (input.markupType && !["percentage", "fixed", "manual"].includes(input.markupType)) {
    throw new CommerceError("COMMERCE_INVALID_PRICE", `Invalid markup type "${input.markupType}".`);
  }

  if (priceOverride !== null && priceOverride > 0) {
    retailPrice = priceOverride;
    source = "override";
  } else if (input.markupType === "percentage") {
    retailPrice = floorPrice * (1 + markupValue / 100);
    source = "percentage";
  } else if (input.markupType === "fixed") {
    retailPrice = floorPrice + markupValue;
    source = "fixed";
  } else if (suggestedRetailPrice !== null && suggestedRetailPrice > 0) {
    retailPrice = suggestedRetailPrice;
    source = "suggested";
  } else {
    retailPrice = floorPrice;
    source = "floor";
  }

  const safeRetailPrice = Math.max(retailPrice, floorPrice);
  const roundedRetailPrice = roundToNinetyNine(safeRetailPrice);

  return {
    retailPrice: roundedRetailPrice,
    floorPrice,
    rounded: roundedRetailPrice !== safeRetailPrice,
    source
  };
}

export class PricingService {
  calculate(input: CommercePriceInput) {
    return calculateCommerceRetailPrice(input);
  }
}

