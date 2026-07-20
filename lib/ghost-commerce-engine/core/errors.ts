export type CommerceErrorCode =
  | "COMMERCE_AUTHENTICATION_REQUIRED"
  | "COMMERCE_SUPPLIER_UNAVAILABLE"
  | "COMMERCE_INVALID_PRODUCT"
  | "COMMERCE_SYNC_FAILED"
  | "COMMERCE_REPOSITORY_ERROR"
  | "COMMERCE_PRODUCT_NOT_FOUND"
  | "COMMERCE_INVALID_PRICE"
  | "COMMERCE_CHECKOUT_DISABLED";

export class CommerceError extends Error {
  code: CommerceErrorCode;
  cause?: unknown;
  detail?: string;

  constructor(code: CommerceErrorCode, message: string, options: { cause?: unknown; detail?: string } = {}) {
    super(message);
    this.name = "CommerceError";
    this.code = code;
    this.cause = options.cause;
    this.detail = options.detail;
  }
}

export function toCommerceError(error: unknown, fallbackCode: CommerceErrorCode = "COMMERCE_SYNC_FAILED") {
  if (error instanceof CommerceError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error || "Commerce operation failed.");
  if (message.includes("SUPPLIER_AUTHENTICATION_REQUIRED")) {
    return new CommerceError("COMMERCE_AUTHENTICATION_REQUIRED", message, { cause: error });
  }

  return new CommerceError(fallbackCode, message, { cause: error });
}

