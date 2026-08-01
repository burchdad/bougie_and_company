# Dear-Lover Sync Agent

Dear-Lover blocks Bougie's Vercel functions from fetching the live catalog directly. This agent runs outside Vercel, opens a real Microsoft Edge session, fetches the same browser JSON catalog pages, and posts them to Bougie's existing raw import endpoint.

The agent updates the same Neon dropshipping tables used by the admin import tool.

## First Run

Install dependencies:

```bash
npm install
```

Add the Bougie admin key to `.env.local`:

```bash
ADMIN_ACCESS_KEY=...
BOUGIE_BASE_URL=https://www.bougieandcompany.com
DEAR_LOVER_BASE_URL=https://ds.dear-lover.com
```

Run Edge in visible mode once so the Dear-Lover session can be logged in:

```bash
npm run sync:dear-lover -- --from=1 --to=1 --dry-run
```

If Dear-Lover asks for login, complete it in the browser window the agent opens, close the agent, then run the real sync.

## Full Catalog Sync

```bash
npm run sync:dear-lover -- --from=1 --to=193 --publish
```

The defaults match the current production import:

- `page-size`: `50`
- `batch-size`: `4`
- `collection`: `dropshipping`
- `markup-type`: `percentage`
- `markup-value`: `60`

The agent writes `.dear-lover-sync-agent-state.json` after each successful import batch. Use `--resume` only when recovering an interrupted run.

## Scheduled Inventory/Price Refresh

After the local profile is logged in, the agent can run headless:

```bash
npm run sync:dear-lover -- --from=1 --to=193 --publish --headless
```

For Windows Task Scheduler, run this command from the repo folder. Use a dedicated Windows user/profile if the sync should run unattended.

## Recovery

If a run fails halfway:

```bash
npm run sync:dear-lover -- --from=1 --to=193 --publish --resume
```

If a specific range needs to be refreshed:

```bash
npm run sync:dear-lover -- --from=181 --to=193 --publish
```
