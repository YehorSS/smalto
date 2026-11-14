# Smalto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use a task-by-task runner to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working demo ceramics shop (EN/IT, light/dark) with 3D glaze preview, test checkout, a Cloudflare backend that never oversells, and an admin panel.

**Architecture:** npm workspaces monorepo. `shared/` holds the catalogue (single source for API seed and web), `api/` is a Hono Worker on D1 built after `D:\RestaurantDemo\api` (copy `password.ts`, the `limit`/`fail`/CORS parts of `guard.ts`, the vitest config and test setup), `web/` is one React app (shop + `/admin`) on GitHub Pages. 3D only on the product page, code-split; everything else uses stills rendered from the same 3D code.

**Tech Stack:** TypeScript, Hono 4, Cloudflare Workers + D1, `@cloudflare/vitest-plugin`, Vitest 4.1, React 19, react-router 7, Vite 7, three 0.187, Playwright, sharp.

**Spec:** `docs/spec.md`

## Global Constraints
- Public repo `YehorSS/smalto`; no assistant or tool credits in commits or files.
- All money in integer euro cents; VAT 22% included in prices; shipping IT 800, EU 1500, free when subtotal ≥ 12000.
- EU country list (27 ISO codes) lives in `shared/` and is used by both sides.
- Test cards: `4242424242424242` ok, `4000000000000002` declined (402); anything else 400. Store last 4 only.
- Order code `SM-XXXX`, alphabet without 0/O/1/I.
- CORS: `https://yehorss.github.io`, `http://localhost:5190`. Admin auth: `Authorization: Bearer <token>`, token stored as SHA-256 in D1, 12 h.
- Roles: owner (secret `OWNER_PASSWORD`), demo (`demo`/`demo`); demo cannot change prices.
- Vite base `/smalto/`; dev port 5190; `404.html` = copy of `index.html`.
- i18n EN/IT, keys equal (test); theme follows system, toggle stored in `localStorage` `sm-theme`; language in `sm-lang`.
- `prefers-reduced-motion`: fades only, 3D does not auto-rotate.

## Review Focus
1. Two buyers, last piece, same moment → exactly one order; stock never negative. (Task 2 test)
2. A tampered client sends its own prices/shipping → server totals win. (Task 2 test)
3. A cancelled order returns its stock once — cancelling twice or cancelling a shipped order does not add stock again. (Task 3 test)
4. A cart in localStorage holding a sku that no longer exists or is sold out → checkout shows it, blocks submit with a message, does not crash. (Task 5 test on `reconcileCart`)
5. No WebGL / context lost on the product page → still image of the selected glaze, glaze picker still works. (Task 6 manual check in the browser)

---

### Task 1: Repo, shared catalogue, API schema and catalogue endpoint

**Files:** root `package.json` (workspaces shared, api, web), `shared/catalog.ts`, `shared/eu.ts`, `api/{package.json,wrangler.jsonc,tsconfig.json,vitest.config.ts}`, `api/migrations/0001_init.sql`, `api/src/{index.ts,guard.ts,password.ts,seed.ts,public.ts}`, `api/test/{setup.ts,env.d.ts,catalog.test.ts}`

**Interfaces — Produces:**
- `shared/catalog.ts`: `type GlazeId = 'latte'|'turchese'|'ramina'|'cobalto'|'miele'|'ferro'`; `type Collection = 'tavola'|'fiori'|'fuoco'`; `interface Piece { id; collection; form: FormId; price: number /*cents*/; size: {h:number; d:number} /*mm*/; capacityMl?: number; care: 'dishwasher'|'hand'; glazes: GlazeId[]; name:{en,it}; blurb:{en,it} }`; `PIECES: Piece[]` (12 pieces per spec); `GLAZES: Record<GlazeId,{name:{en,it}; color:string; ...material params}>`; `sku(pieceId, glaze) = \`${pieceId}-${glaze}\``.
- `shared/eu.ts`: `EU: string[]`, `shippingCents(country, subtotal): number`.
- Tables: `products(id PK, price)`, `stock(sku PK, product_id, glaze, qty INTEGER NOT NULL CHECK (qty >= 0))`, `orders(code PK, created_at, status, name, email, street, city, postcode, country, card_last4, subtotal, shipping, total, source)`, `order_lines(order_code, sku, qty, unit_price)`, `users`, `sessions(token_hash PK, login, expires_at)`, `hits`.
- `seed(db)`: idempotent; prices from `PIECES`, stock deterministic per sku (0–12, at least two skus at 0 and two at 1–2).
- `GET /api/products` → `[{id, price, stock: Record<GlazeId, number>}]`.

- [ ] Step 1: tests in `api/test/catalog.test.ts`: `seed` twice leaves 12 products; every piece glaze has a stock row; `GET /api/products` returns 12 with stock maps; CORS header present for the Pages origin and absent for `https://evil.example`; `UPDATE stock SET qty=-1` throws (CHECK).
- [ ] Step 2: `npm test -w api` → FAIL (no app).
- [ ] Step 3: implement.
- [ ] Step 4: `npm test -w api` → PASS. `npx tsc -p api --noEmit` clean.
- [ ] Step 5: commit "API: catalogue, schema, products endpoint".

### Task 2: Orders

**Files:** `api/src/orders.ts`, `api/src/codes.ts`, `api/test/orders.test.ts`

**Interfaces — Produces:** `POST /api/orders` body `{items:[{sku,qty}], customer:{name,email,street,city,postcode,country}, card:{number,expiry,cvc}, website}` → 201 `{code, lines:[{sku,qty,unitPrice}], subtotal, shipping, total}`; errors `{error, message, ...}`: 400 `invalid` (with `field`), 402 `declined`, 409 `out_of_stock` with `stock: Record<sku, number>`, 429 `too_many`. `totals(lines, country)` pure function exported for tests.

- [ ] Step 1: tests: totals with IT/EU/free threshold (11999 → +shipping, 12000 → free); client-sent `price`/`shipping` fields ignored; declined card → 402 and no order row, stock unchanged; unknown card → 400; expired card (past month) → 400; each validation edge (name 1 and 81 chars, bad e-mail, country `US`, 11 lines, qty 0 and 11, duplicate sku lines merged); honeypot filled → 201-shaped fake response, nothing stored; two parallel orders for a sku with qty 1 → statuses sorted `[201, 409]`, qty 0; 6th order in a minute from one IP → 429.
- [ ] Step 2: run → FAIL.
- [ ] Step 3: implement. Insert order + lines + `UPDATE stock SET qty = qty - ? WHERE sku = ?` in one `db.batch`; on CHECK failure catch, re-read stock of the requested skus, return 409.
- [ ] Step 4: run → PASS.
- [ ] Step 5: commit "API: orders with server totals, test cards and no overselling".

### Task 3: Auth and admin API

**Files:** `api/src/auth.ts`, `api/src/admin.ts`, `api/test/{auth,admin}.test.ts`

**Interfaces — Produces:** `POST /api/auth/login` → `{token, login, role}`; `POST /api/auth/logout`; `GET /api/auth/me`; `requireRole(...roles)` reads Bearer. Admin: `GET /api/admin/orders?q=&status=&from=&to=` → `[{code, created_at, status, name, email, total, items}]`; `GET/PATCH /api/admin/orders/:code` (`{status}`; allowed `paid→packed→shipped`, `paid|packed→cancelled`, else 409 `bad_transition`); `GET /api/admin/stock` → `[{sku, product_id, glaze, qty, price}]`; `PATCH /api/admin/stock/:sku` `{qty}` (0–999); `PATCH /api/admin/products/:id` `{price}` owner only; `GET /api/admin/summary?days=7` → `{days:[{date, orders, revenue}], toPack, lowStock:[{sku, qty}], top:[{product_id, qty}]}`.

- [ ] Step 1: tests: demo and owner log in and `me` works with the token; wrong password 401; 6th failure 429; no/expired token 401; demo PATCH price → 403, owner → 200; status walk paid→packed→shipped ok, shipped→cancelled 409; cancel from packed restores stock exactly once (second cancel 409, qty unchanged); search by code, name, e-mail; summary has 7 days, revenue excludes cancelled.
- [ ] Step 2: run → FAIL. Step 3: implement (port from restaurant `auth.ts`, cookie → Bearer, token hashed). Step 4: PASS.
- [ ] Step 5: commit "API: bearer auth, admin orders, stock, prices, summary".

### Task 4: Nightly demo reset

**Files:** `api/src/demo.ts`, `api/test/demo.test.ts`, cron in `wrangler.jsonc` (`0 3 * * *`), `POST /api/admin/reset` (owner).

**Interfaces — Produces:** `resetDemo(db, now, rand)`: deletes orders/lines/sessions of demo, reseeds prices and stock, inserts 25–40 orders over the past 7 days (statuses mixed, newest mostly `paid`), decrementing stock accordingly and never below 0.

- [ ] Step 1: tests: after reset order count in [25, 40], all within 7 days, no stock negative, prices back to seed after an owner price change, deterministic with a seeded `rand`.
- [ ] Step 2–4: FAIL → implement → PASS. Step 5: commit "API: nightly demo reset".

### Task 5: Web shell, cart, i18n, theme

**Files:** `web/{package.json,vite.config.ts,tsconfig.json,index.html}`, `web/src/{main.tsx,App.tsx,api.ts,cart.ts,i18n.ts,theme.ts,filters.ts}`, `web/src/ui/{Header,CartDrawer,Footer,DemoNote}.tsx`, `web/src/styles.css`, `web/test/{cart,filters,i18n}.test.ts`

**Interfaces — Produces:** `cart.ts`: `type Line = {sku, qty}`; `cartReducer(state, action)` with `add|set|remove|clear` (merge same sku, qty clamped 1–10, max 10 lines); `useCart()` hook persisted in `sm-cart`; `reconcileCart(lines, products) → {lines, issues:[{sku, kind:'gone'|'short', available}]}`; `freeShippingLeft(subtotal) → cents`. `filters.ts`: `parseFilters(search) / writeFilters(f)` for `collection, glaze[], min, max, instock, sort`. `api.ts`: `getProducts()`, `placeOrder()`, admin calls with token in `sessionStorage` `sm-token`. Routes: `/`, `/shop`, `/p/:id`, `/checkout`, `/order/:code`, `/admin/*`.

- [ ] Step 0: design direction — run design-taste-frontend `draw.mjs` (sector closest to retail/craft, brief "ceramics workshop in Faenza", sections per the spec) and record the chosen direction, fonts and palette in the work notes; map the palette to light and dark tokens.
- [ ] Step 1: tests: reducer merge/clamp/limit/remove; `reconcileCart` gone + short cases; free-shipping math; filters round-trip and junk params ignored; i18n EN/IT key and placeholder parity.
- [ ] Step 2–4: FAIL → implement → PASS; `npm run build -w web` succeeds; dev server on 5190 shows header, drawer, footer in both themes.
- [ ] Step 5: commit "Web: shell, cart, filters, i18n, themes".

### Task 6: 3D pieces, viewer, stills

**Files:** `web/src/three/{forms.ts,glaze.ts,Viewer.tsx}`, `tools/stills.mjs`, `web/public/stills/<sku>-{800,1600}.webp`, `web/test/forms.test.ts`

**Interfaces — Produces:** `forms.ts`: `profile(form: FormId): Vector2[]` (lathe outline incl. wall thickness, foot ring, lip; mug/pitcher handles as tube geometry; jar lid separate); `glaze.ts`: `glazeMaterial(id, rough: boolean)` MeshPhysicalMaterial with clearcoat + generated speckle/drip texture; `Viewer` props `{piece, glaze}` — RoomEnvironment lighting, soft contact shadow, drag to rotate, crossfade between glaze materials over 400 ms, pauses when off-screen, falls back to the still on no WebGL or `webglcontextlost`. `tools/stills.mjs` opens `/smalto/__stills?sku=` in headless GPU Chrome and writes the WebP pair with sharp.

- [ ] Step 1: tests: each profile is closed, monotonic in y where the wall rises, height matches `piece.size.h` scaled; every `Piece.form` has a profile; every glaze has material params.
- [ ] Step 2–4: FAIL → implement → PASS; look at the viewer in Chrome for every form; run `node tools/stills.mjs` → one pair per sku.
- [ ] Step 5: commit "3D pieces, glaze materials, viewer, stills".

### Task 7: Shop pages and pictures

**Files:** `web/src/pages/{Home,Shop,Product,Checkout,Order}.tsx`, `tools/photos.mjs`, `web/public/photos/*`, `web/public/photos/credits.json`

- [ ] Step 1: pick ≥ 6 real pictures with design-taste-frontend `assets.mjs` (Faenza streets/museum, kilns, historic maiolica); download, WebP ≤ 200 KB, credits.
- [ ] Step 2: build pages per spec and the drawn direction: shop filters wired to the URL; product glaze swatches with stock labels, sold-out disabled; checkout form with field errors from the API (`field`), test card box, 402/409 messages (409 updates the cart through `reconcileCart`); order page.
- [ ] Step 3: full test suite green; screens at 1440/390 in both themes and languages (no horizontal scroll); design inspector 0 FAIL.
- [ ] Step 4: commit "Shop pages, pictures, checkout".

### Task 8: Admin UI

**Files:** `web/src/admin/{Login,Overview,Orders,OrderDetail,Stock}.tsx`, `web/test/admin.test.ts` (formatting helpers only)

- [ ] Step 1: login (shows demo/demo hint), overview (7-day bars drawn in SVG, to-pack count, low stock), orders list + detail with allowed status buttons only, stock table with inline qty edit, price edit for owner. Touch ≥ 44 px, EN/IT, both themes, 401 → back to login.
- [ ] Step 2: suite green, screens at 1024 and 390.
- [ ] Step 3: commit "Admin panel".

### Task 9: Deploy and end-to-end

**Files:** `.github/workflows/{ci,pages}.yml`, `scripts/e2e.mjs`, `README.md`

- [ ] Step 1: `wrangler d1 create smalto-demo`, id into `wrangler.jsonc`, remote migrations, deploy; **the author runs** `npx wrangler secret put OWNER_PASSWORD` in `api/`; owner `POST /api/admin/reset`.
- [ ] Step 2: create repo `YehorSS/smalto`, Pages source = Actions, push, wait for the deploy.
- [ ] Step 3: `node scripts/e2e.mjs` against live: order with 4242 → seen in admin as demo → cancel → stock back. Expected: all steps pass.
- [ ] Step 4: add Smalto to GEKKO-MO, Obsidian notes (`Smalto.md`, `Все проекты.md`, `Главная.md`).
