# Spectrum Display Inc. — Website Prototype

**Company**: Spectrum Display Inc.  
**Domain**: spectrumdisplay.com  

Modern LED display distributor website featuring:

- **Online sales experience** inspired by Dell.com (catalog, configurator, cart, transparent pricing)
- **Product pages** inspired by DJI.com (immersive layout, sticky buy bar, specs tabs)

## The 5 Brands

| Brand     | Type                  | Notes |
|-----------|-----------------------|-------|
| **TRT**   | Partner (Transtech)   | Fine pitch, Discovery series, LedPoster, US support |
| **Gloshin** | Partner (Gloshine)  | Rental, transparent Vanish, fixed & outdoor |
| **BAKO**  | Partner               | Fine pitch COB, Diamond rental, all-in-ones |
| **DIAO**  | Exclusive (yours)     | Value-driven professional fixed install line |
| **Element** | Exclusive (yours)   | Performance rental & creative / XR series |

## Pages

- `index.html` – Homepage
- `brands.html` – Brand showcase
- `products.html` – Catalog with filters
- `product.html` – Detailed product + configurator (TRT Discovery example)
- `cart.html` – Cart (localStorage)
- `contact.html` – Quote / contact form

## How to Preview

Open `index.html`, or run the local server (needed for the product database and admin):

```bash
cd spectrum-display
npm install
npm start
```

Visit http://localhost:3000

### Admin catalog

1. Open http://localhost:3000/admin.html
2. Sign in with `admin@spectrumdisplay.com` and the admin password stored in your local `.env` (`ADMIN_PASSWORD`).
3. Add or edit products, including photos, pitches, cabinet size, and $/m² pricing.

Without Supabase keys, data is stored locally in `data/spectrum.db`.

### Supabase (recommended)

The SPECTRUM project is already connected. Copy `.env.example` to `.env` if needed, then `npm start`.

Products, brands, and the admin login live in Supabase. New photos go to the `product-images` storage bucket.


### Contact form

The contact page posts to `/api/contact`. Set `CONTACT_TO_EMAIL` plus either:

- **Resend:** `RESEND_API_KEY` (and optionally `CONTACT_FROM_EMAIL`)
- **SMTP:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (Gmail: smtp.gmail.com, port 465, an [App Password](https://myaccount.google.com/apppasswords))

Inquiries are also stored in the `contact_inquiries` table in Supabase.

## Next Steps

1. Real product photos & exact models/pricing for DIAO and Element.
2. Cart / orders still live in this browser only (`localStorage`).
