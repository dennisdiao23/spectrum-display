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
| **Gloshine** | Partner | Full factory lineup: MV Ultra, DN, Vanish, AF II COB, outdoor rental, posters |
| **BAKO** | Partner | Fine pitch COB |
| **DIAO** | Exclusive | Value-driven professional fixed install |
| **Element** | Exclusive | Performance rental & creative / XR |

## Pages

| File | Page |
|---|---|
| `index.html` | Homepage |
| `products.html` | Catalog with filters |
| `product.html` | Product + configurator |
| `solutions.html` | Solutions |
| `support.html` | Support |
| `designer.html` | Designer / saved projects (needs Sign in) |
| `account.html` | Customer Sign in / account |
| `cart.html` | Cart (only after Sign in — **this browser only**) |
| `contact.html` | Quote / contact form (emails you) |
| `admin.html` | Catalog admin (separate from customer Sign in) |

## Preview on this PC

**Full steps (Cloud Cursor → git pull → localhost):** [LOCAL-REVIEW.md](LOCAL-REVIEW.md)

```bash
cd C:\Users\denni\OneDrive\Desktop\spectrum-display
git checkout main
git pull origin main
npm install
npm start
```

Open http://localhost:3000 — Designer: http://localhost:3000/designer.html

Copy `.env.example` to `.env` for local keys. With Supabase vars, you use the live catalog. Without them, data is a local SQLite file at `data/spectrum.db`.

**See mobile on a PC:** in Chrome, open the site → **F12** → **Ctrl + Shift + M**. Pick a phone at the top (for example iPhone 12 Pro) and refresh. That is a size preview, not a real iPhone. If the page looks old: Ctrl+C, pull again, `npm start`, then **Ctrl + F5**.

### Admin catalog

1. Open http://localhost:3000/admin.html (or `/admin.html` on the live site).
2. Sign in as `admin@spectrumdisplay.com` with the password in local `.env` (`ADMIN_PASSWORD`) when using SQLite. Live admin already exists in Supabase.
3. Add or edit products, photos, pitches, cabinet size, and $/m².

Customer **Sign in** on the public site is not the admin login.

### Contact form

The contact page posts to `/api/contact`. Production uses **Resend**. Inquiries are also stored in Supabase `contact_inquiries`.

Do not put API keys or `SPECTRUM_ADMIN_SECRET` in this repo.

## Google search

The site is not hidden from Google. It just was not submitted. After this is live on **`main`**:

1. Open [Google Search Console](https://search.google.com/search-console) as `dennisdiao@diaoinc.com`.
2. Add **Domain** property `spectrumdisplay.com` and add the TXT record in GoDaddy DNS.
3. Submit sitemap `https://www.spectrumdisplay.com/sitemap.xml`.
4. Request indexing for `https://www.spectrumdisplay.com/`.

Full steps: [HOW-IT-RUNS.md](HOW-IT-RUNS.md) section 8.

## How updates go live

1. Edit files (local Cursor or Cloud Agent).
2. Commit and merge to **`main`**.
3. Watch Railway **web** until the deploy is **SUCCESS**.
4. Check https://www.spectrumdisplay.com

After Cloud Agent changes, on your PC: `git pull origin main`. OneDrive does not update GitHub.

## Not done yet (on purpose)

1. Real product photos and exact models/pricing for DIAO and Element.
2. Cart / orders stay in **this browser only**. They are not shared across phones and are not stored in Supabase. **Prices and the cart only show after Sign in.**
