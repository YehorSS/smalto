# Smalto — ceramics shop demo

A working online shop for a fictional ceramics workshop in Faenza: 3D glaze preview, cart, test checkout and an admin panel. Demo only: payments are tests and orders are wiped every night.

**Live:** https://yehorss.github.io/smalto/ · **Admin:** https://yehorss.github.io/smalto/admin (demo / demo)

- `web/` — React 19 + TypeScript + Vite, three.js for the product viewer (loaded only on product pages). EN / IT, light and dark.
- `api/` — Cloudflare Worker (Hono) + D1. Prices, VAT and shipping are computed on the server; stock can never go below zero, even when two people buy the last piece at once.
- `shared/` — the catalogue used by both.
- `tools/` — renders the catalogue stills from the same 3D code, prepares the found pictures.

Test cards: `4242 4242 4242 4242` pays, `4000 0000 0000 0002` is declined.

```
npm install
npm test                # API (real local D1) and web
npm run dev -w api      # http://localhost:8787
npm run dev -w web      # http://localhost:5190/smalto/
```

Pictures of Faenza and its maiolica come from The Metropolitan Museum of Art and Wikimedia Commons; authors and licences are listed on the site.
