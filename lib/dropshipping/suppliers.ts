import type { SupplierAdapter } from "./types";
import { dearLoverAdapter } from "./suppliers/dear-lover";

const suppliers = [dearLoverAdapter];

export function listSupplierAdapters() {
  return suppliers;
}

export function getSupplierAdapter(supplierKey: string): SupplierAdapter {
  const adapter = suppliers.find((supplier) => supplier.supplierKey === supplierKey);
  if (!adapter) {
    throw new Error(`Unsupported supplier "${supplierKey}".`);
  }

  return adapter;
}
