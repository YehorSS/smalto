# Smalto — ceramics shop demo · design

Portfolio demo (2026-11-14). An online shop for a fictional ceramics workshop in Faenza, with a real backend: orders land in a database and the owner works them in an admin panel. Labelled on every page as a demo; payment is a test, no money moves.

## Goals
- A client opens the shop, picks a cup, changes its glaze and sees it in 3D, orders it with a test card, then opens the admin with `demo / demo` and sees that order. They understand: "this can be taken as is".
- Looks like a quiet, expensive craftsman's shop, not a template: no hero-with-three-cards, no stock product photos, no fake reviews or press.
- Fast: the catalogue never loads 3D; the product page loads it on demand. Works on a phone.
- Everything hosts for free (GitHub Pages + Cloudflare free tier).

## The shop
- **Name:** «Smalto — bottega di ceramica, Faenza» (smalto = glaze). Faenza gave the word "faience".
- **Catalogue:** 12 pieces in 3 collections, each with 2–4 glazes and its own stock per glaze:
  - *Tavola* (table): cup, mug, bowl, side plate, dinner plate.
  - *Fiori* (flowers): bud vase, tall vase, pitcher.
  - *Fuoco* (wood-fired, rougher): tea bowl, jar with lid, serving dish, candle holder.
  - Glazes from a fixed set: bianco latte, turchese, verde ramina, blu cobalto, miele, ferro (dark iron). Names and techniques are real; the workshop and its pieces are invented.
- **Each piece:** name, collection, price in EUR (VAT 22% included, shown at checkout), dimensions, capacity where it applies, care (dishwasher / hand wash), a note that handmade pieces vary slightly, glaze options with stock.
- **Shipping:** Italy €8, rest of the EU €15, free over €120. Outside the EU — not offered (said at checkout).

## Pictures
- Pieces are **drawn in 3D**, never found photos passed off as the shop's goods: each form is a lathe profile (like a potter's wheel), glaze is a physical material with clearcoat and a baked speckle/drip texture; the *Fuoco* line has a rougher clay with ash spots.
- **The live thing:** on the product page, pick a glaze and the piece re-glazes in 3D (colour crossfades ~400 ms); drag or swipe to turn it. Without WebGL — the still of that glaze.
- **Catalogue and cart use stills:** the same 3D scenes rendered ahead of time to WebP (each piece × each glaze, 800 and 1600 px), so lists stay light. Hovering a glaze swatch on a card swaps the still.
- **Real pictures of the world around the shop** from open collections (PD / CC BY / CC BY-SA): Faenza streets and the ceramics museum, kilns, historic Faenza maiolica (Met, Wikimedia). Captioned as what they are; authors credited in the footer. At least 4 real pictures on the home page.

## Pages
- **Home:** first screen — name, one line on what it is, a large still of one piece, "Shop the pieces". Then the three collections, how a piece is made (throwing → bisque → glaze → second firing, with real kiln/museum pictures), Faenza and its maiolica, shipping and care in short, footer with credits and the demo note.
- **Shop:** grid of pieces; filters — collection, glaze colour, price range, "in stock only"; sort — featured / price up / price down. Filters live in the URL so a filtered view can be shared.
- **Product:** 3D viewer, glaze swatches with stock ("2 left", "sold out" — sold-out glaze can't be added), quantity, add to cart, details, related pieces from the same collection.
- **Cart:** a drawer from the side, reachable from every page; change quantity, remove; subtotal and the free-shipping threshold ("€34 to free shipping"). Persists in localStorage.
- **Checkout:** one page — contact (name, e-mail), address (street, city, postcode, country from the EU list), shipping cost by country, summary with VAT, test card form. A box states the test numbers: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined. Any future expiry, any 3-digit CVC.
- **Confirmation:** order code `SM-XXXX`, items, total, shipping address, "try the admin (demo / demo)".
- **Admin** (`/admin`, same app): see below.
- Routing with clean URLs on GitHub Pages: `404.html` is a copy of `index.html`.

## Backend
Cloudflare Worker (TypeScript, Hono) + D1, built the same way as `D:\RestaurantDemo\api` and reusing its pieces (password hashing, rate limit, demo reset pattern). Own worker `smalto-demo`, own D1 `smalto-demo`.

Public:
- `GET /api/products?lang=` — catalogue with prices and stock per glaze.
- `POST /api/orders` — `{items:[{sku, qty}], customer:{name, email, street, city, postcode, country}, card:{number, expiry, cvc}, website}` (`website` is a honeypot) → `{code, items, totals}`.
  - The server computes every price, VAT and shipping; prices from the client are ignored.
  - Card: only the test numbers are accepted, the declined one returns 402 with a message; anything else is 400. Only the last 4 digits are stored.
  - **No overselling:** the order and all stock decrements run in one D1 batch; `stock` has `CHECK (stock >= 0)`, so a short item fails the whole batch → 409 with the fresh stock of the short items.
  - Validation: name 2–80, valid e-mail, postcode 3–10, country in the EU list, 1–10 lines, qty 1–10 each.
  - Limits: 5 orders and 60 catalogue requests a minute per IP (counter in D1). CORS only for `https://yehorss.github.io` and localhost.

Admin (Bearer token in the `Authorization` header; the shop and the API are on different domains, so no cookies):
- `POST /api/auth/login` `{login, password}` → `{token, role}`; `POST /api/auth/logout`; `GET /api/auth/me`.
- `GET /api/admin/orders?q=&status=&from=&to=` — search by code, name, e-mail.
- `GET /api/admin/orders/:code`, `PATCH /api/admin/orders/:code` `{status}`.
  - Status flow: `paid → packed → shipped`; `cancelled` from `paid` or `packed` puts the stock back.
- `GET /api/admin/stock`, `PATCH /api/admin/stock/:sku` `{stock}`; `PATCH /api/admin/products/:id` `{price}`.
- `GET /api/admin/summary?days=7` — orders and revenue per day, top pieces.
- Roles: **owner** (password from the secret `OWNER_PASSWORD`) — everything; **demo** (`demo / demo`, written on the site) — orders and stock, not prices. Checked on the server on every request.
- Passwords PBKDF2-SHA256 (100 000 iterations, salt). Token: random, stored hashed in D1, 12 h. Login: 5 failures in 10 min per IP → 10 min pause.

Nightly reset (cron 03:00 UTC): deletes all orders and demo changes, restores catalogue and stock from seed, creates 25–40 plausible orders over the past 7 days in mixed statuses. The site says orders live until the nightly reset.

## Admin screens
- **Overview:** orders and revenue for 7 days (small bar chart), orders waiting to be packed, low-stock glazes.
- **Orders:** list with search and status filter; order detail with items, address, totals, status buttons.
- **Stock:** table of pieces × glazes, editable stock; price editable for owner only.
- Tablet-friendly (touch ≥ 44 px), EN/IT, light and dark like the shop.

## Look
- Light: warm off-white ground, near-black ink, glaze colours as the only accents. Dark: graphite ground, warm light ink, same accents tuned for contrast. Follows the system by default; a toggle; choice in localStorage. Both themes pass contrast AA.
- Serif display face with Italian accents for headings, a calm sans for text (picked from the design-taste-frontend draw in the plan step).
- Motion: cart drawer slides, cards fade in, glaze crossfade; all off under `prefers-reduced-motion` (fades only).
- No horizontal scroll at 390 px; no default scrollbar replacement needed beyond what the other sites use.

## Languages
English (default) and Italian (default for `it` browsers), switch, choice in localStorage. Shop and admin both. Keys match in both (test).

## Stack and repo
- Public repo `YehorSS/smalto`, no assistant or tool credits in commits or files.
- `api/` — Worker, migrations, seed, tests. `web/` — React 19 + TypeScript + Vite, react-router, three.js (product page only, code-split). `tools/` — still renderer (headless Chrome over the same viewer), photo fetcher.
- Pages deploy by GitHub Actions; the API by `wrangler deploy` from this machine.

## Checks
- API (Vitest + `@cloudflare/vitest-pool-workers`, real local D1): server-side totals and shipping thresholds; client prices ignored; two parallel orders for the last item → one 201, one 409; declined card → 402, nothing stored; cancel restores stock; demo can't change prices; login lockout; validation; nightly reset.
- Web (Vitest): cart reducer (add/merge/limit/remove), free-shipping progress, URL filters round-trip, i18n key parity.
- Playwright: order on the site → visible in the admin as demo → cancel → stock back.
- Screens at 1440 / 390, both themes, both languages; design inspector with 0 FAIL.

## Not doing
Real payments, e-mails, customer accounts, reviews, coupons, multiple currencies, shipping outside the EU, product text editing in the admin.
