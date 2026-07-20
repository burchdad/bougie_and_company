import { dearLoverCapabilities } from "../adapters/dear-lover/types";

export const ghostCommerceEngineMetadata = {
  name: "Ghost Commerce Engine",
  version: "0.2.0-alpha",
  phaseStatus: "phase-1-complete-phase-2-contracts",
  supportedSupplierKeys: ["dear-lover"],
  adapterCapabilities: {
    "dear-lover": dearLoverCapabilities
  }
} as const;

