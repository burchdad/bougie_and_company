import { isAdminRequest } from "@/lib/admin-products";
import { isDropshippingEnabled } from "@/lib/dropshipping/config";
import { importRawSupplierProducts, publishAllSyncedDropshipProducts } from "@/lib/dropshipping/db";
import type { MarkupType } from "@/lib/dropshipping/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedOrigins = new Set([
  "https://www.bougieandcompany.com",
  "https://bougieandcompany.com",
  "https://dear-lover.com",
  "https://www.dear-lover.com",
  "https://ds.dear-lover.com"
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigin = allowedOrigins.has(origin) ? origin : "https://www.bougieandcompany.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-admin-key",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    Vary: "Origin"
  };
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function escapeControlCharactersInStrings(value: string) {
  let repaired = "";
  let inString = false;
  let escaped = false;

  for (const char of value) {
    if (!inString) {
      repaired += char;
      if (char === "\"") {
        inString = true;
      }
      continue;
    }

    if (escaped) {
      repaired += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      repaired += char;
      escaped = true;
      continue;
    }

    if (char === "\"") {
      repaired += char;
      inString = false;
      continue;
    }

    if (char === "\n") {
      repaired += "\\n";
      continue;
    }

    if (char === "\r") {
      repaired += "\\r";
      continue;
    }

    if (char === "\t") {
      repaired += "\\t";
      continue;
    }

    repaired += char;
  }

  return repaired;
}

function parseRawJsonText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return JSON.parse(escapeControlCharactersInStrings(trimmed)) as unknown;
  }
}

function splitConcatenatedJson(value: string) {
  const parts: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        parts.push(value.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return parts;
}

function parseRawJsonTexts(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    return [parseRawJsonText(value)];
  } catch {
    return splitConcatenatedJson(value)
      .map((part) => {
        try {
          return parseRawJsonText(part);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }
}

function extractRawProducts(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  const record = asRecord(value);
  if (Array.isArray(record.products)) {
    return record.products;
  }

  if (Array.isArray(record.list)) {
    return record.list;
  }

  const data = asRecord(record.data);
  if (Array.isArray(data.list)) {
    return data.list;
  }

  return [];
}

function extractAllRawProducts(body: Record<string, unknown>) {
  const sources = [
    body.products,
    body.envelope,
    body.raw,
    ...parseRawJsonTexts(body.rawText),
    ...(Array.isArray(body.envelopes) ? body.envelopes : [])
  ];

  const products = sources.flatMap((source) => extractRawProducts(source));
  const seen = new Set<string>();

  return products.filter((product) => {
    const record = asRecord(product);
    const supplierId = String(record.id || "");

    if (!supplierId) {
      return true;
    }

    if (seen.has(supplierId)) {
      return false;
    }

    seen.add(supplierId);
    return true;
  });
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request);

  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401, headers });
  }

  if (!isDropshippingEnabled()) {
    return Response.json({ ok: false, message: "Dropshipping is disabled." }, { status: 404, headers });
  }

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const supplierKey = typeof body.supplierKey === "string" && body.supplierKey.trim() ? body.supplierKey.trim() : "dear-lover";
    const rawProducts = extractAllRawProducts(body);

    if (!rawProducts.length) {
      return Response.json({ ok: false, message: "No supplier products were found in the import payload." }, { status: 400, headers });
    }

    const importResult = await importRawSupplierProducts(supplierKey, rawProducts, {
      importType: "browser-json",
      pages: Array.isArray(body.envelopes) ? body.envelopes.length : undefined
    });
    let publishResult: { publishedCount: number } | null = null;

    if (body.publish === true) {
      const markupType = typeof body.markupType === "string" ? body.markupType as MarkupType : "percentage";
      publishResult = await publishAllSyncedDropshipProducts({
        supplierKey,
        markupType,
        markupValue: Number.isFinite(Number(body.markupValue)) ? Number(body.markupValue) : null,
        collection: typeof body.collection === "string" && body.collection.trim() ? body.collection.trim() : "dropshipping"
      });
    }

    return Response.json({ ok: true, importResult, publishResult }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not import raw supplier products.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers });
  }
}
