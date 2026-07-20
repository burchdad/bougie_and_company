import { CommerceError } from "../../core/errors";
import type { CommerceProductSearchRequest } from "../../core/types";
import type { DearLoverConfig, DearLoverEnvelope } from "./types";

const searchPath = "/h-dropship-searchProducts.json";
const browserUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function buildSearchUrl(baseUrl: string, params: CommerceProductSearchRequest) {
  const url = new URL(searchPath, baseUrl.replace(/\/$/, ""));
  url.searchParams.set("sort", params.sort || "");
  url.searchParams.set("page", String(params.page || 1));
  url.searchParams.set("psize", String(params.pageSize || 30));
  url.searchParams.set("filters", params.filters || "");
  if (params.keywords) {
    url.searchParams.set("keywords", params.keywords);
  }
  url.searchParams.set("_", String(Date.now()));
  return url;
}

function parseSupplierJson(text: string): DearLoverEnvelope | null {
  try {
    return JSON.parse(text) as DearLoverEnvelope;
  } catch {
    return null;
  }
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function isLikelyAuthenticationFailure(value: unknown) {
  const record = asRecord(value);
  const status = String(record.status || "").toLowerCase();
  const message = String(record.msg || record.message || record.error || "").toLowerCase();

  return status === "false" || message.includes("login") || message.includes("auth") || message.includes("session") || message.includes("cookie");
}

function nonJsonSupplierError(response: Response, text: string) {
  const contentType = response.headers.get("content-type") || "unknown content type";
  const body = text.slice(0, 500).toLowerCase();

  if (body.includes("login") || body.includes("sign in") || body.includes("password")) {
    return new CommerceError("COMMERCE_AUTHENTICATION_REQUIRED", `Dear-Lover returned login HTML instead of JSON (HTTP ${response.status}, ${contentType}).`);
  }

  if (body.includes("cloudflare") || body.includes("cf-browser-verification") || body.includes("enable javascript")) {
    return new CommerceError("COMMERCE_AUTHENTICATION_REQUIRED", `Dear-Lover returned browser verification instead of JSON (HTTP ${response.status}, ${contentType}).`);
  }

  return new CommerceError("COMMERCE_AUTHENTICATION_REQUIRED", `Dear-Lover returned ${contentType} instead of JSON from the catalog endpoint (HTTP ${response.status}).`);
}

export class DearLoverTransport {
  private config: DearLoverConfig;

  constructor(config: DearLoverConfig) {
    this.config = config;
  }

  async searchProducts(params: CommerceProductSearchRequest): Promise<DearLoverEnvelope> {
    if (this.config.useFixture && this.config.fixtureEnvelope) {
      return this.config.fixtureEnvelope();
    }

    const fetchImpl = this.config.fetchImpl || fetch;
    const baseUrl = this.config.baseUrl.replace(/\/$/, "");
    const response = await fetchImpl(buildSearchUrl(baseUrl, params), {
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "accept-language": "en-US,en;q=0.9",
        referer: new URL("/h-dropship-publishList.html", baseUrl).toString(),
        "user-agent": browserUserAgent,
        "x-requested-with": "XMLHttpRequest",
        ...(this.config.authCookie ? { cookie: this.config.authCookie } : {})
      },
      cache: "no-store"
    });

    if (response.status === 401 || response.status === 403) {
      throw new CommerceError("COMMERCE_AUTHENTICATION_REQUIRED", `Dear-Lover returned HTTP ${response.status}.`);
    }

    if (!response.ok) {
      throw new CommerceError("COMMERCE_SUPPLIER_UNAVAILABLE", `Dear-Lover search failed with HTTP ${response.status}.`);
    }

    const responseText = await response.text();
    const raw = parseSupplierJson(responseText);
    if (!raw) {
      throw nonJsonSupplierError(response, responseText);
    }

    if (isLikelyAuthenticationFailure(raw)) {
      throw new CommerceError("COMMERCE_AUTHENTICATION_REQUIRED", "Dear-Lover rejected the supplier request.");
    }

    return raw;
  }
}

