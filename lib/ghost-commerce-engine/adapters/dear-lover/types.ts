import type { CommerceSupplierCapabilities } from "../../core/types";

export const dearLoverSupplierKey = "dear-lover";

export const dearLoverCapabilities: CommerceSupplierCapabilities = {
  catalogSearch: true,
  catalogSync: true,
  inventorySync: true,
  orderSubmission: false,
  orderStatus: false,
  tracking: false
};

export type DearLoverConfig = {
  baseUrl: string;
  authCookie?: string;
  useFixture?: boolean;
  fixtureEnvelope?: () => DearLoverEnvelope;
  fetchImpl?: typeof fetch;
};

export type DearLoverEnvelope = {
  status?: boolean | string;
  msg?: string;
  message?: string;
  error?: string;
  data?: {
    list?: unknown[];
    page?: number;
    psize?: number;
    total?: number;
    total_page?: number;
    has_more?: boolean | number;
  };
};

