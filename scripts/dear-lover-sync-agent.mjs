#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const defaultStatePath = resolve(projectRoot, ".dear-lover-sync-agent-state.json");
const defaultProfileDir = resolve(projectRoot, ".dear-lover-agent-profile");

function readEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

readEnvFile(resolve(projectRoot, ".env"));
readEnvFile(resolve(projectRoot, ".env.local"));

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (item === "--help" || item === "-h") {
      args.help = true;
      continue;
    }

    const match = item.match(/^--([^=]+)(?:=(.*))?$/);
    if (!match) {
      continue;
    }

    args[match[1]] = match[2] ?? true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

function printHelp() {
  console.log(`
Dear-Lover sync agent

Runs a real Microsoft Edge browser session against Dear-Lover, then imports the
raw catalog pages into Bougie through /api/admin/dropshipping/products/import-raw.

Required:
  ADMIN_ACCESS_KEY=...                 Bougie admin key

Useful env:
  BOUGIE_BASE_URL=https://www.bougieandcompany.com
  DEAR_LOVER_BASE_URL=https://ds.dear-lover.com
  DEAR_LOVER_AGENT_USER_DATA_DIR=.dear-lover-agent-profile

Examples:
  npm run sync:dear-lover -- --from=1 --to=193 --publish
  npm run sync:dear-lover -- --from=181 --to=193 --publish --headless
  npm run sync:dear-lover -- --from=1 --to=193 --publish --batch-size=4

Flags:
  --from=1              First Dear-Lover page to fetch.
  --to=193              Last Dear-Lover page to fetch.
  --page-size=50        Dear-Lover page size.
  --batch-size=4        Pages per Bougie import request.
  --publish             Publish/import into the Dropshipping collection.
  --markup-value=60     Publish markup percentage.
  --collection=...      Storefront collection handle.
  --headless            Run Edge headless after the profile has logged in once.
  --resume              Recovery mode: skip pages already marked imported in the state file.
  --dry-run             Fetch pages but do not post to Bougie.
`);
}

if (args.help) {
  printHelp();
  process.exit(0);
}

function asInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value, fallback = false) {
  if (value === true) {
    return true;
  }
  if (value === false) {
    return false;
  }
  if (value == null) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function loadState(path) {
  if (!existsSync(path)) {
    return { importedPages: [], lastRunAt: null };
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return {
      importedPages: Array.isArray(parsed.importedPages) ? parsed.importedPages : [],
      lastRunAt: parsed.lastRunAt || null
    };
  } catch {
    return { importedPages: [], lastRunAt: null };
  }
}

function saveState(path, state) {
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
}

async function withRetries(label, operation, retries, delayMs) {
  let lastError;
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt > retries) {
        break;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`${label} failed on attempt ${attempt}: ${message}`);
      await sleep(delayMs * attempt);
    }
  }
  throw lastError;
}

function ensureJsonEnvelope(value, pageNumber) {
  if (!value || typeof value !== "object") {
    throw new Error(`Dear-Lover page ${pageNumber} did not return a JSON object.`);
  }

  const data = value.data && typeof value.data === "object" ? value.data : {};
  const list = Array.isArray(data.list) ? data.list : [];
  if (!list.length) {
    throw new Error(`Dear-Lover page ${pageNumber} returned no products. The browser session may be logged out.`);
  }

  return { envelope: value, list };
}

async function main() {
  const config = {
    bougieBaseUrl: String(process.env.BOUGIE_BASE_URL || "https://www.bougieandcompany.com").replace(/\/$/, ""),
    dearLoverBaseUrl: String(process.env.DEAR_LOVER_BASE_URL || "https://ds.dear-lover.com").replace(/\/$/, ""),
    adminKey: process.env.ADMIN_ACCESS_KEY || process.env.BOUGIE_ADMIN_KEY || "",
    from: asInteger(args.from, 1),
    to: asInteger(args.to, 193),
    pageSize: asInteger(args["page-size"], 50, { min: 1, max: 100 }),
    batchSize: asInteger(args["batch-size"], 4, { min: 1, max: 10 }),
    sort: String(args.sort || ""),
    filters: String(args.filters || ""),
    keywords: String(args.keywords || ""),
    publish: asBoolean(args.publish, false),
    markupType: String(args["markup-type"] || "percentage"),
    markupValue: asNumber(args["markup-value"], 60),
    collection: String(args.collection || "dropshipping"),
    headless: asBoolean(args.headless, false),
    resume: asBoolean(args.resume, false),
    dryRun: asBoolean(args["dry-run"], false),
    statePath: resolve(projectRoot, String(args["state-file"] || defaultStatePath)),
    userDataDir: resolve(projectRoot, String(process.env.DEAR_LOVER_AGENT_USER_DATA_DIR || args["user-data-dir"] || defaultProfileDir)),
    retries: asInteger(args.retries, 2, { min: 0, max: 10 }),
    delayMs: asInteger(args.delay, 400, { min: 0, max: 60_000 }),
    importDelayMs: asInteger(args["import-delay"], 1_500, { min: 0, max: 60_000 })
  };

  if (!config.adminKey && !config.dryRun) {
    throw new Error("ADMIN_ACCESS_KEY or BOUGIE_ADMIN_KEY is required unless --dry-run is used.");
  }

  if (config.to < config.from) {
    throw new Error("--to must be greater than or equal to --from.");
  }

  mkdirSync(config.userDataDir, { recursive: true });

  const { chromium } = await import("playwright-core");
  const context = await chromium.launchPersistentContext(config.userDataDir, {
    channel: "msedge",
    headless: config.headless,
    viewport: { width: 1440, height: 1000 }
  });

  const state = loadState(config.statePath);
  const importedPages = new Set(state.importedPages.map((page) => Number(page)).filter(Number.isFinite));
  const page = context.pages()[0] || await context.newPage();

  try {
    await page.goto(`${config.dearLoverBaseUrl}/h-dropship-searchProducts.html`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000
    });

    console.log(`Dear-Lover sync agent starting pages ${config.from}-${config.to}.`);
    console.log(`Posting to ${config.bougieBaseUrl}${config.dryRun ? " (dry run)" : ""}.`);

    let batch = [];
    let productsSeen = 0;

    async function importBatch(force = false) {
      if (!batch.length || (!force && batch.length < config.batchSize)) {
        return;
      }

      const pages = batch.map((item) => item.pageNumber);
      const envelopes = batch.map((item) => item.envelope);
      const label = `Import pages ${pages[0]}-${pages[pages.length - 1]}`;

      if (config.dryRun) {
        console.log(`${label}: dry run, skipped Bougie import.`);
      } else {
        const result = await withRetries(label, async () => {
          const response = await fetch(`${config.bougieBaseUrl}/api/admin/dropshipping/products/import-raw`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-admin-key": config.adminKey
            },
            body: JSON.stringify({
              supplierKey: "dear-lover",
              envelopes,
              publish: config.publish,
              markupType: config.markupType,
              markupValue: config.markupValue,
              collection: config.collection
            })
          });
          const json = await response.json().catch(() => ({}));
          if (!response.ok || json.ok === false) {
            throw new Error(json.message || `Bougie import returned HTTP ${response.status}.`);
          }
          return json;
        }, config.retries, 2_000);

        console.log(`${label}: imported ${result.importResult?.productsSeen ?? "?"} products, ${result.importResult?.variantsSeen ?? "?"} variants.`);
      }

      for (const pageNumber of pages) {
        importedPages.add(pageNumber);
      }
      saveState(config.statePath, {
        importedPages: [...importedPages].sort((a, b) => a - b),
        lastRunAt: new Date().toISOString()
      });
      batch = [];
      await sleep(config.importDelayMs);
    }

    for (let pageNumber = config.from; pageNumber <= config.to; pageNumber += 1) {
      if (config.resume && importedPages.has(pageNumber)) {
        console.log(`Skipping page ${pageNumber}; already imported in state file.`);
        continue;
      }

      const url = new URL("/h-dropship-searchProducts.json", config.dearLoverBaseUrl);
      url.searchParams.set("sort", config.sort);
      url.searchParams.set("page", String(pageNumber));
      url.searchParams.set("psize", String(config.pageSize));
      url.searchParams.set("filters", config.filters);
      if (config.keywords) {
        url.searchParams.set("keywords", config.keywords);
      }
      url.searchParams.set("_", String(Date.now()));

      const envelope = await withRetries(`Fetch page ${pageNumber}`, async () => {
        const raw = await page.evaluate(async (requestUrl) => {
          const response = await fetch(requestUrl, {
            headers: {
              accept: "application/json, text/javascript, */*; q=0.01",
              "x-requested-with": "XMLHttpRequest"
            },
            credentials: "include"
          });
          const text = await response.text();
          return {
            ok: response.ok,
            status: response.status,
            contentType: response.headers.get("content-type") || "",
            text
          };
        }, url.toString());

        if (!raw.ok) {
          throw new Error(`Dear-Lover returned HTTP ${raw.status}.`);
        }

        let parsed;
        try {
          parsed = JSON.parse(raw.text);
        } catch {
          throw new Error(`Dear-Lover returned non-JSON content (${raw.contentType || "unknown content type"}).`);
        }

        return ensureJsonEnvelope(parsed, pageNumber).envelope;
      }, config.retries, 2_000);

      const { list } = ensureJsonEnvelope(envelope, pageNumber);
      productsSeen += list.length;
      console.log(`Fetched page ${pageNumber}: ${list.length} products.`);
      batch.push({ pageNumber, envelope });

      await importBatch(false);
      await sleep(config.delayMs);
    }

    await importBatch(true);
    console.log(`DONE pages ${config.from}-${config.to}. Fetched ${productsSeen} products before variant expansion.`);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
