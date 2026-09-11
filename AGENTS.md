# AGENTS.md

## Always plan first

Dennis wants a plan before any implementation — even when he did not ask for one.

- Before coding, editing files, or diving into a long investigation, reply with a short plan: what will change, where, and the intended user-facing result.
- Do this on every task, including follow-ups and “just do it” requests.
- Present the plan, then wait for Dennis to say **Go**. Do not start coding until he says Go.
- Keep the plan concrete (screens, clicks, files). Do not estimate calendar time.

## Bug reports

When Dennis reports a bug (screenshot, “nothing show up”, broken UI, or similar):

- Do not start coding yet.
- First tell him **why** it is happening: the actual cause from the live page, API, or code (for example the layout collapsed, a request failed, or JS never ran). Not a guess after a fix.
- Then give a short plan: what will change, where, and what he should see after.
- Wait for **Go**.
- A short investigation to find the why is allowed. Editing files to fix it is not, until he says Go.

## Cursor Cloud specific instructions

Spectrum Display is a static HTML/CSS/JS marketing + catalog website (`index.html`, `products.html`,
`product.html`, `brands.html`, `cart.html`, `contact.html`, `account.html`, `designer.html`
at `/led-wall-calculator`, `company.html` at `/company`, `store.html` at `/store` and
`store.spectrumdisplay.com`) served by a small Express backend in `server/`. The backend exposes a product/brand
catalog API and a cookie-session company login used by `/company`, `/company/website`, and `/company/inventory`.

### Running the app (single service)

- Start the dev server with `npm start` (`node server/index.js`). It listens on `PORT` (default `3000`)
  and serves both the static site and the `/api/*` endpoints. There is no separate frontend build/dev
  server — the HTML files are served as-is.
- Visit `http://localhost:3000`. Company UI is at `/company` (`/company/website`, `/company/inventory`).
- Local US Store preview: `http://localhost:3000/store`. Production hostname is `https://store.spectrumdisplay.com`
  (same Express app; add the custom domain on Railway and CNAME `store` to the same Railway target as `www`).

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
- After a **push**, wait until Railway production is **online** (deploy SUCCESS and the live site is
  serving the new commit). Then send a message **in this chat** so Dennis knows it is live. Include
  https://www.spectrumdisplay.com and the PR number. Do not stop at “merged — Railway will deploy.”

### When Dennis must do something himself

Dennis is a Designer, not IT. If he has to click in **any** outside dashboard — Google Cloud, Railway,
GoDaddy, Resend, Gmail, Search Console, Shopify, Supabase, or similar — do **not** dump a short
coder checklist. Always give:

- The **exact link** to open (full `https://…` URL). Prefer a page that is already on the right project.
- **Which Google / email account** to use if it matters (usually `dennisdiao@diaoinc.com`).
- **Numbered clicks**: 1. Open this link. 2. Click this named button. 3. Paste this exact text.
- What the screen should look like when that step worked.
- What **not** to change (so he does not break Continue with Google, DNS, or an existing client).
- Never ask him to put secrets in GitHub. Railway / Google secret boxes only.

This applies to Gmail OAuth, Railway variables, DNS, API keys, domain connects, and anything similar.
A full click-by-click example is in **Staff Gmail send — you do this once** below.

### Live production accounts

- Do not create customer accounts on https://www.spectrumdisplay.com with fake or generated emails.
- Never use `@spectrumdisplay.com` for website **Create account** (company staff login is `/company`).
- Never use `wallv2.*` or other synthetic addresses. Those bounce Supabase Auth confirmation mail and
  can suspend sending. Test signup on localhost (`npm start`) or a mailbox you control.

### Company list tables

- Every company list table keeps its column header row pinned while the body scrolls (Inventory, Location,
  Vendor, Customer, Sales, PO, Receipt Shipment, Website Products/Accounts, Settings staff/roles, and any
  new list). Same for inner document line tables.
- Implement with sticky `thead th` inside the table’s scroll wrap (`overflow: auto` on `.cc-table-wrap`
  or equivalent). Header cells need an opaque background so rows do not paint through.
- Do not drop this when adding a new split-view or list page.

## Staff Gmail send — you do this once

Company Email (quote / order / invoice / PO) sends from **your Gmail**, not the shared contact-form
address. The website cannot do that until you create a Google “door key” and paste two values into
Railway. You only do this once. After that, each staff person clicks **Connect Gmail** in `/company`.

Use Google account **`dennisdiao@diaoinc.com`**. Do **not** edit the existing Continue-with-Google
login settings. Those stay as they are.

### A. Turn on Gmail send in Google Cloud

**1. Open the Spectrum Google project**

- Link: https://console.cloud.google.com/home/dashboard?project=nifty-condition-506807-a2
- If Google asks you to sign in, use `dennisdiao@diaoinc.com`.
- Top bar should say **Spectrum Display** (project id `nifty-condition-506807-a2`), under
  organization **spectrumdisplay.com**.
- If a **Select a resource** box is open, click the row **Spectrum Display** (not Cancel).
- If the top bar still says **Select a project**, click it → **Spectrum Display**.

**2. Turn on the Gmail API** (lets the website send mail through Gmail)

- Link: https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=nifty-condition-506807-a2
- You should see **Gmail API**. Ignore **Try this API** (that is a playground, not what we need).
- Click **Enable**. If the button says **Manage**, it is already on — skip to step 3.

**3. Open the consent screen (the Google permission page staff will see)**

- Link: https://console.cloud.google.com/auth/audience?project=nifty-condition-506807-a2
- If that page is missing, use: https://console.cloud.google.com/apis/credentials/consent?project=nifty-condition-506807-a2
- Publishing status may already be **In production** because customer “Continue with Google” uses this
  project. Leave that as it is.
- **Test users:** add every staff Gmail that will click Connect Gmail (your own first).
  - Click **Add users** (or **+ Add users**).
  - Paste the Gmail, for example `dennisdiao@diaoinc.com`.
  - Save.
- If Google will not let you add test users because the app is already in production, still continue.
  Staff may see an “unverified app” warning the first time. Click **Advanced** → **Go to Spectrum
  Display (unsafe)** — that is Google’s wording, not a virus. We can apply for Google verification
  later so the warning goes away.

**4. Allow the “send email” permission**

- Link: https://console.cloud.google.com/auth/scopes?project=nifty-condition-506807-a2
- If that page is missing: consent screen → **Data Access** / **Scopes** → **Add or remove scopes**.
- Add:
  - `https://www.googleapis.com/auth/gmail.send`
  - `https://www.googleapis.com/auth/userinfo.email`
- Save.

**5. Create a new Web client (do not reuse the customer login client)**

- Link: https://console.cloud.google.com/apis/credentials?project=nifty-condition-506807-a2
- Click **+ Create credentials** → **OAuth client ID**.
- If Google asks you to configure the consent screen first, finish step 3, then come back.
- Application type: **Web application**.
- Name: `Spectrum Company Gmail` (any name is fine).
- **Authorized JavaScript origins** — click **Add URI** and add both, exactly:
  - `https://www.spectrumdisplay.com`
  - `http://localhost:3000`
- **Authorized redirect URIs** — click **Add URI** and add both, exactly (no extra slash at the end):
  - `https://www.spectrumdisplay.com/api/admin/gmail/callback`
  - `http://localhost:3000/api/admin/gmail/callback`
- Click **Create**.
- A box shows **Your Client ID** and **Your Client Secret**. Leave it open. You will paste these into
  Railway next. Never put them in GitHub.

If you already have an OAuth client for Continue with Google / Supabase, **leave it alone**. This
Company Gmail client is extra.

### B. Put the two values on Railway (the live website)

Railway is the computer that runs https://www.spectrumdisplay.com.

**1. Open the live app service**

- Link: https://railway.com
- Sign in with `dennisdiao@diaoinc.com`.
- Open project **spectrum-display**.
- Click service **web** (the website, not a database).
- Direct project link if you see it: https://railway.com/project/0417ceae-d2ed-4a51-b2d1-64a31db5b8b9

**2. Add two variables**

- Open the **Variables** tab.
- Click **New Variable** (or **Add variable**).
- Name (exactly): `GOOGLE_GMAIL_CLIENT_ID`
- Value: the **Client ID** from Google (long string ending in `.apps.googleusercontent.com`).
- Add another:
  - Name: `GOOGLE_GMAIL_CLIENT_SECRET`
  - Value: the **Client secret** from Google.
- Save. Railway usually redeploys by itself.
- Wait until the latest **Deployment** is **SUCCESS**. Then open https://www.spectrumdisplay.com
  and do step C.

Optional later: `GMAIL_TOKEN_SECRET` (any long random phrase). If you skip it, the server uses the
existing admin secret.

### C. Connect your Gmail in Company

1. Open https://www.spectrumdisplay.com/company and sign in.
2. Open a quote, order, invoice, or PO → **Email**, or go to **Settings** → **Your Gmail**.
3. Click **Connect Gmail**.
4. Pick **your** Gmail (the inbox customers should reply to).
5. Click **Allow**.
6. You should return to Company with **From** showing that Gmail. **Send** then uses it.

If Google says redirect URI mismatch, the redirect URI in step A5 does not match exactly. Fix the
URI, save, wait for Railway if you also changed variables, then Connect again.

If Connect works for a week then asks again: the Google app is still in **Testing**. That is normal.
Reconnect. Publishing / Google verification is a later step if you want it to stay connected.

The public **contact form** is separate. It still sends through Resend from
`hello@send.spectrumdisplay.com` to `sales@spectrumdisplay.com`.

## Staff Shopify checkout — you do this once

The US Store page is ours (`store.spectrumdisplay.com`). **Pay / Check out** is Shopify.
Add to cart stays grey until Shopify has a product with a variant ID. You do not paste IDs by
hand — Company **Website → Store → Sync to Shopify** does that after this token is on Railway.

Use Shopify account **`dennisdiao@diaoinc.com`**. Shop: **spectrum-display**
(`n0eg5t-nw.myshopify.com`). Do **not** point the `store` DNS record at Shopify — that hostname
stays on Railway.

### A. Allow the website to create products in Shopify

**1. Open app development**

- Link: https://admin.shopify.com/store/n0eg5t-nw/settings/apps/development
- If Shopify asks you to sign in, use `dennisdiao@diaoinc.com`.
- You should see **Develop apps** (or **App development**) for this shop.

**2. Create the app** (skip if you already have one named Spectrum Store sync)

- Click **Allow custom app development** if Shopify asks — confirm **Allow**.
- Click **Create an app**.
- App name: `Spectrum Store sync`
- Click **Create app**.

**3. Turn on product permission**

- Open **Configuration** (or **API credentials** / **Admin API integration**).
- Click **Configure** next to **Admin API integration**.
- Enable:
  - `read_products`
  - `write_products`
- Click **Save**.

**4. Install and copy the token**

- Open **API credentials**.
- Click **Install app** → **Install**.
- Under **Admin API access token**, click **Reveal token once**.
- Copy the token (starts with `shpat_`). Leave the tab open. Never put it in GitHub.

### B. Put the token on Railway

**1. Open the live website service**

- Link: https://railway.com/project/0417ceae-d2ed-4a51-b2d1-64a31db5b8b9
- Sign in with `dennisdiao@diaoinc.com`.
- Click service **web**.

**2. Add the variable**

- Open **Variables**.
- **New Variable**:
  - Name (exactly): `SHOPIFY_ADMIN_ACCESS_TOKEN`
  - Value: the `shpat_…` token from Shopify.
- Save. Wait until the new **Deployment** is **SUCCESS**.

`SHOPIFY_SHOP` can stay `n0eg5t-nw.myshopify.com` (already the default).

### C. Turn off the Shopify storefront password

Checkout links go to `n0eg5t-nw.myshopify.com/cart/…`. If the shop still has a password,
customers cannot pay.

- Link: https://admin.shopify.com/store/n0eg5t-nw/online_store/preferences
- Under **Password protection**, turn the password **off** (uncheck **Enable password** / click
  **Remove password**).
- Save.
- The default Shopify theme at `n0eg5t-nw.myshopify.com` may become visible. Leave it. Customers
  use https://store.spectrumdisplay.com. Do not connect `store.spectrumdisplay.com` as a Shopify
  domain.

### D. Sync products

1. Open https://www.spectrumdisplay.com/company/website/store and sign in.
2. Click **Sync to Shopify**.
3. Wait until it says how many SKUs were created or updated (priced NovaStar boxes/spares only).
4. Open https://store.spectrumdisplay.com/collections/control — **Add to cart** should work on
   priced items that have warehouse qty.

If Sync says it is not set up, Railway is missing `SHOPIFY_ADMIN_ACCESS_TOKEN` or the deploy
has not finished. Do not paste the token into chat or GitHub.

Dealer nets, FOB, and warehouse cost stay in Company. Shopify only gets the street/MAP price.
