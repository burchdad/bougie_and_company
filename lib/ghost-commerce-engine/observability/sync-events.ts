export type CommerceSyncEvent =
  | { type: "sync.started"; supplierKey: string; syncRunId: string | number }
  | { type: "sync.product.upserted"; supplierKey: string; supplierProductId: string; variants: number }
  | { type: "sync.product.failed"; supplierKey: string; supplierProductId: string; message: string }
  | { type: "sync.completed"; supplierKey: string; syncRunId: string | number; status: string }
  | { type: "sync.failed"; supplierKey: string; syncRunId?: string | number; message: string };

