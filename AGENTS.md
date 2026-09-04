# AGENTS.md

## Always plan first

Dennis wants a plan before any implementation — even when he did not ask for one.

- Before coding, editing files, or diving into a long investigation, reply with a short plan: what will change, where, and the intended user-facing result.
- Do this on every task, including follow-ups and “just do it” requests.
- Present the plan, then start. Do not wait for approval unless the plan is ambiguous or conflicts with a prior instruction.
- Keep the plan concrete (screens, clicks, files). Do not estimate calendar time.

## Cursor Cloud specific instructions

Spectrum Display is a static HTML/CSS/JS marketing + catalog website (`index.html`, `products.html`,
`product.html`, `brands.html`, `cart.html`, `contact.html`, `account.html`, `designer.html`
at `/led-wall-calculator`, `company.html` at `/company`) served by a small Express backend in `server/`. The backend exposes a product/brand
catalog API and a cookie-session company login used by `/company`, `/company/website`, and `/company/inventory`.

### Running the app (single service)

- Start the dev server with `npm start` (`node server/index.js`). It listens on `PORT` (default `3000`)
  and serves both the static site and the `/api/*` endpoints. There is no separate frontend build/dev
  server — the HTML files are served as-is.
- Visit `http://localhost:3000`. Company UI is at `/company` (`/company/website`, `/company/inventory`).

### Database: Supabase vs local SQLite fallback

- Storage backend is chosen at startup in `server/store.js`: if `SUPABASE_URL` plus a Supabase key
  (`SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_ANON_KEY`) are set, it uses Supabase; otherwise it falls
  back to local SQLite at `data/spectrum.db`.
- With no Supabase env vars, the app runs fully on SQLite with zero external dependencies — this is the
  default in Cloud. On first run it auto-seeds the admin account and the catalog from
  `server/seed-catalog.json`, then fills missing `products.details` from `server/product-details.json`.
- Public panel catalog is **database only**. Pages load `/api/catalog` via `js/catalog-api.js`. Do not
  include `js/products-data.js` on HTML pages. Edit series in **Admin → Products**. NovaStar control
  gear is also stored as products (`type: control`, brand `novastar`) and edited in Admin.
- The SQLite store uses Node's built-in `node:sqlite` (`server/db.js`), which requires Node 22+ (an
  `ExperimentalWarning` is printed and is harmless). No native/compiled sqlite package is installed.
- `data/` and `uploads/products/` are gitignored and created at runtime; deleting `data/spectrum.db`
  resets the local DB and re-seeds on next start.

### Admin credentials (local SQLite mode)

- The first admin is seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` env vars, defaulting to
  `admin@spectrumdisplay.com` / `ChangeMe!Admin`. These are only applied when seeding an empty DB — to
  change them after seeding, delete `data/spectrum.db` and restart.
- Copy `.env.example` to `.env` to set credentials, Supabase keys, or `PORT`. `.env` is gitignored.

### Lint / test / build

- There are no lint, test, or build scripts. `package.json` defines only `start`. The site is plain
  HTML/JS with no bundler.

### Agent workflow preferences (Dennis)

- **Always include the PR number** (and link) at the end of a finished change.
- When the user says **push**, that means: `git push` the branch, then **merge the PR into `main`**
  so Railway deploys production. Hosting is Railway-only; merge to `main` triggers deploy.
- If the PR cannot merge (conflicts, failing checks), resolve or report the blocker — do not stop at
  push-only when the user asked to push.

### Company list tables

- Every company list table keeps its column header row pinned while the body scrolls (Inventory, Vendor,
  Customer, Sales, PO, Receipt Shipment, Website Products/Accounts, Settings staff/roles, and any new
  list). Same for inner document line tables.
- Implement with sticky `thead th` inside the table’s scroll wrap (`overflow: auto` on `.cc-table-wrap`
  or equivalent). Header cells need an opaque background so rows do not paint through.
- Do not drop this when adding a new split-view or list page.
