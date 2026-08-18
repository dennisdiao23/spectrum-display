# Spectrum Display Inc.

LED catalog site for **Spectrum Display Inc.**

**Live site:** https://www.spectrumdisplay.com

This is the durable place to look things up later. Chat history can get summarized when it gets long — do not keep token/session reports. Put lasting facts here and in [HOW-IT-RUNS.md](HOW-IT-RUNS.md).

## How it stays online

| Piece | Job |
|---|---|
| **GoDaddy** | Domain + DNS. `www` points at Railway. Bare `spectrumdisplay.com` forwards to www. |
| **Railway** | Runs the website (`npm start`). Merge to **`main`** deploys. |
| **GitHub** | This repo. Not the live site by itself. |
| **Supabase** | Catalog, customer Sign in, saved projects, contact copies, product photos. |
| **Google** | Continue with Google. |
| **Resend → Gmail** | Contact form emails `dennisdiao@diaoinc.com`. |

Full map, env var names, DNS, and “if X breaks look here”: **[HOW-IT-RUNS.md](HOW-IT-RUNS.md)**.

Hosting is **Railway only** (not Netlify or Vercel).

## Brands

| Brand | Type | Notes |
|---|---|---|
| **TRT** | Partner (Transtech) | Fine pitch, Discovery series, LedPoster, US support |
| **Gloshin** | Partner (Gloshine) | Rental, transparent Vanish, fixed & outdoor |
| **BAKO** | Partner | Fine pitch COB, Diamond rental, all-in-ones |
| **DIAO** | Exclusive | Value-driven professional fixed install |
| **Element** | Exclusive | Performance rental & creative / XR |

## Pages

| File | Page |
|---|---|
| `index.html` | Homepage |
| `brands.html` | Brand showcase |
| `products.html` | Catalog with filters |
| `product.html` | Product + configurator |
| `designer.html` | Designer / saved projects (needs Sign in) |
| `account.html` | Customer Sign in / account |
| `cart.html` | Cart (**this browser only** — `localStorage`) |
| `contact.html` | Quote / contact form (emails you) |
| `admin.html` | Catalog admin (separate from customer Sign in) |

## Preview on this PC

```bash
npm install
npm start
```

Open http://localhost:3000

Copy `.env.example` to `.env` for local keys. With Supabase vars, you use the live catalog. Without them, data is a local SQLite file at `data/spectrum.db`.

**See mobile on a PC:** in Chrome, open the site → **F12** → **Ctrl + Shift + M**. Pick a phone at the top (for example iPhone 12 Pro) and refresh. That is a size preview, not a real iPhone.

### Admin catalog

1. Open http://localhost:3000/admin.html (or `/admin.html` on the live site).
2. Sign in as `admin@spectrumdisplay.com` with the password in local `.env` (`ADMIN_PASSWORD`) when using SQLite. Live admin already exists in Supabase.
3. Add or edit products, photos, pitches, cabinet size, and $/m².

Customer **Sign in** on the public site is not the admin login.

### Contact form

The contact page posts to `/api/contact`. Production uses **Resend**. Inquiries are also stored in Supabase `contact_inquiries`.

Do not put API keys or `SPECTRUM_ADMIN_SECRET` in this repo.

## How updates go live

1. Edit files (local Cursor or Cloud Agent).
2. Commit and merge to **`main`**.
3. Watch Railway **web** until the deploy is **SUCCESS**.
4. Check https://www.spectrumdisplay.com

After Cloud Agent changes, on your PC: `git pull origin main`. OneDrive does not update GitHub.

## Not done yet (on purpose)

1. Real product photos and exact models/pricing for DIAO and Element.
2. Cart / orders stay in **this browser only**. They are not shared across phones and are not stored in Supabase.
