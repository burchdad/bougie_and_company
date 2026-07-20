import type { CommerceError } from "./errors";

export type CommerceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: CommerceError };

export function ok<T>(value: T): CommerceResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(error: CommerceError): CommerceResult<T> {
  return { ok: false, error };
}

