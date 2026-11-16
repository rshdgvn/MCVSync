# Click-through suites

Browser click-throughs that drive the real `app` production build against a real `api`, at 360px and 1440px.

| Suite | Covers |
|---|---|
| `receiving` | Purchase Order receiving: unknown barcode, not on document, expiry mismatch, over-receipt, short receipt, a fully matched receipt closing the PO, a closed PO refusing scans, resolving a discrepancy with a note, and the PO detail embed |
| `transfers` | Branch transfers: role tabs, new request, cancel, FEFO picking, override codes, the insufficient-stock panel and supplier PO, shipping, receiving a transfer, and the FEFO override code page |
| `accounting` | Items reference COGS, setting and re-pricing client prices with the current, zone-average and COGS hints, price history, approving a payment (future dates blocked), payment history, the pending pricing placeholder, and Admin's read-only view |
| `home` | Purchasing Home: every card against its server count, the oldest-first Needs Action list, card and entry links, the non-main branch's shipments card, and other roles keeping their own home |

## Run

```sh
cd scripts/clickthrough
npm install
npx playwright-core install chromium
npm run receiving
npm run transfers
npm run accounting
npm run home
```

Each run creates a fresh SQLite database in the OS temp folder, migrates and seeds it (`seeds/<suite>.php`), builds `app` with `VITE_API_URL=http://localhost:8000/api`, serves the API on port 8000 and the build on port 5173, runs the suite, and stops both servers. Screenshots are saved to `<temp>/mcvsync-clickthrough-<suite>/shots`. Your own database is never touched.

## Requirements

- Ports 8000 and 5173 free. The API's Sanctum and CORS settings only trust `localhost:5173`.
- `php` on the PATH, or set `PHP_BINARY`.
- `api/vendor` and `app/node_modules` installed.
- To use an existing Chromium instead of the downloaded one, set `CHROME_PATH`.

The exit code is non-zero when any check fails.
