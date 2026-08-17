# AGENTS.md

## Cursor Cloud specific instructions

Spectrum Display is a static HTML/CSS/JS marketing + catalog website (`index.html`, `products.html`,
`product.html`, `brands.html`, `cart.html`, `contact.html`, `account.html`, `designer.html`,
`admin.html`) served by a small Express backend in `server/`. The backend exposes a product/brand
catalog API and a cookie-session admin login used by `admin.html`.

### Running the app (single service)

- Start the dev server with `npm start` (`node server/index.js`). It listens on `PORT` (default `3000`)
  and serves both the static site and the `/api/*` endpoints. There is no separate frontend build/dev
  server — the HTML files are served as-is.
- Visit `http://localhost:3000`. Admin UI is at `/admin.html`.

### Database: Supabase vs local SQLite fallback

- Storage backend is chosen at startup in `server/store.js`: if `SUPABASE_URL` plus a Supabase key
  (`SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_ANON_KEY`) are set, it uses Supabase; otherwise it falls
  back to local SQLite at `data/spectrum.db`.
- With no Supabase env vars, the app runs fully on SQLite with zero external dependencies — this is the
  default in Cloud. On first run it auto-seeds the admin account and the catalog from
  `server/seed-catalog.json`.
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
