type EposConfig = {
  baseUrl: string;
  authToken: string;
};

export type EposProduct = Record<string, unknown>;
export type EposProductStock = Record<string, unknown>;

function getEposConfig(): EposConfig {
  const baseUrl = process.env.EPOS_API_BASE_URL || "https://api.eposnowhq.com/api/V4";
  const authToken = process.env.EPOS_AUTH_TOKEN;

  if (!authToken) {
    throw new Error("EPOS_AUTH_TOKEN is not configured.");
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    authToken
  };
}

function getAuthHeader(authToken: string) {
  return authToken.startsWith("Basic ") ? authToken : `Basic ${authToken}`;
}

export async function eposFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getEposConfig();
  const endpoint = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${config.baseUrl}${endpoint}`, {
    ...init,
    headers: {
      Authorization: getAuthHeader(config.authToken),
      "Content-Type": "application/json",
      ...(init?.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Epos request failed: ${response.status} ${response.statusText} ${body}`.trim());
  }

  return (await response.json()) as T;
}

export async function fetchEposCollection<T>(resource: string, maxPages = 25): Promise<T[]> {
  const records: T[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const separator = resource.includes("?") ? "&" : "?";
    const pageRecords = await eposFetch<T[]>(`${resource}${separator}page=${page}`);

    if (!Array.isArray(pageRecords) || pageRecords.length === 0) {
      break;
    }

    records.push(...pageRecords);

    if (pageRecords.length < 200) {
      break;
    }
  }

  return records;
}

export function getEposId(record: Record<string, unknown>) {
  const id = record.Id ?? record.ID ?? record.id;
  return typeof id === "number" || typeof id === "string" ? String(id) : null;
}

export function getEposNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

export function getEposString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return null;
}

export async function updateEposProduct(productId: string, raw: Record<string, unknown>, fields: { name: string; description: string; sku: string; salePrice: number | null }) {
  return eposFetch<Record<string, unknown>>(`Product/${productId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...raw,
      Id: Number(productId),
      Name: fields.name,
      Description: fields.description,
      Sku: fields.sku,
      SalePrice: fields.salePrice
    })
  });
}

export async function updateEposProductStock(stockId: string, raw: Record<string, unknown>, currentStock: number) {
  return eposFetch<Record<string, unknown>>(`ProductStock/${stockId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...raw,
      Id: Number(stockId),
      CurrentStock: currentStock
    })
  });
}
