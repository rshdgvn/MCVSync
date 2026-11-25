# Click-through suites

Browser click-throughs that drive the real `app` production build against a real `api`, at 360px and 1440px.

| Suite | Covers |
|---|---|
| `receiving` | Purchase Order receiving: unknown barcode, not on document, expiry mismatch, over-receipt, short receipt, a fully matched receipt closing the PO, a closed PO refusing scans, resolving a discrepancy with a note, and the PO detail embed |
| `transfers` | Branch transfers: role tabs, new request, cancel, FEFO picking, override codes, the insufficient-stock panel and supplier PO, shipping, receiving a transfer, and the FEFO override code page |
| `accounting` | Items reference COGS, setting and re-pricing client prices with the current, zone-average and COGS hints, price history, approving a payment (future dates blocked), payment history, the pending pricing placeholder, and Admin's read-only view |
| `home` | Purchasing Home: every card against its server count, the oldest-first Needs Action list, card and entry links, the non-main branch's shipments card, and other roles keeping their own home |
| `sales` | Sales intake and COFs: logging a message with its attachment, the aging chip and sidebar badge, converting a message to a manual COF, reviewing a portal COF beside the submission (match indicator, standing discount, Differs from request with a reason), forwarding, the insufficient-stock panel, Awaiting Accounting blocking forward, Send Back for Revision on mobile, confirming a cancellation after picking with Download DR, the status tabs, and Accounting and Purchasing access |

## Run

```sh
cd scripts/clickthrough
npm install
npx playwright-core install chromium
npm run receiving
npm run transfers
npm run accounting
npm run home
npm run sales
```

Each run creates a fresh SQLite database in the OS temp folder, migrates and seeds it (`seeds/<suite>.php`), builds `app` with `VITE_API_URL=http://localhost:8000/api`, serves the API on port 8000 and the build on port 5173 (plus Reverb on 8080 for `offline`), runs the suite, and stops the servers. Your own database is never touched.

Each run's folder, `<temp>/mcvsync-clickthrough-<suite>`, holds:

- `shots/`: screenshots
- `build.log` and `build-info.txt`: the full build output, the module count, the git HEAD and `git status` of `app/`
- `api.log`, `app.log` (and `reverb.log`): server output
- `result.txt`: `passed`, `failed` or `crashed`

A passing run's folder is replaced by the next run. A failed or crashed run's folder is kept as `mcvsync-clickthrough-<suite>-<result>-<timestamp>` so it can be inspected later; delete those folders when you're done with them.

The runner stops with a clear error when:

- port 8000, 5173 or 8080 is already in use (it names the process holding it);
- the API, app or Reverb server exits during startup (it points to that server's log);
- the build resolved app files under two spellings of the same path (usually the drive letter's case on Windows), which bundles React twice and crashes every page. Every path the runner uses comes from the real on-disk spelling to prevent this.

## Requirements

- Ports 8000, 5173 and 8080 free. The API's Sanctum and CORS settings only trust `localhost:5173`.
- `php` on the PATH, or set `PHP_BINARY`.
- `api/vendor` and `app/node_modules` installed.
- To use an existing Chromium instead of the downloaded one, set `CHROME_PATH`.

The exit code is non-zero when any check fails.
