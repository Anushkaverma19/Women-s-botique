# MEHRAÉ

**Modern Heirlooms, Rooted in India.**

MEHRAÉ is a premium Indian fashion boutique e-commerce platform: a cinematic storefront, a real Supabase-backed catalogue and checkout system, and **ASK MEHRAÉ**, an AI shopping concierge grounded entirely in the live product catalogue.

This is a full, working application - not a mockup. Every page reads from and writes to a real Postgres database via Supabase; there are no hardcoded product arrays anywhere in the codebase.

---

## Features

**Storefront**
- Cinematic homepage: full-viewport hero video, scroll-linked parallax/scale/opacity transitions (Framer Motion), a connected second cinematic video section, editorial copy, `prefers-reduced-motion` support
- Database-backed catalogue: search, category/colour/size/stock filters, sorting, pagination
- Product detail pages with image galleries, variant (colour/size) selection, disabled unavailable combinations, related products
- Style by Occasion - real, database-backed results per occasion tab (Wedding, Festive, Evening, Formal, Gift, Everyday Luxury)

**Commerce**
- Shopping bag with live inventory-aware quantity controls
- Coupon codes validated entirely server-side (`WELCOME10`, `FESTIVE500` seeded)
- Checkout with simulated payment (Successful / Failed) - no Stripe or any real payment gateway
- Atomic, transactional checkout via a Postgres function: inventory is locked, validated and deducted, the order and snapshot line items are created, and the cart is cleared - all in one transaction, so a failed payment or a stock race condition can never leave inventory or orders in a bad state
- Order history and detail pages with purchase-time snapshots (name/SKU/price/size/color) that never change even if the catalogue is edited later

**Accounts & Admin**
- Supabase Auth (email/password), with `customer` and `admin` roles
- Row Level Security on every table: customers can only ever see their own cart/orders/profile; admin writes require a verified `admin` role checked server-side, never a client-supplied flag
- Admin console (visually distinct from the storefront): dashboard (orders, revenue, low-stock SKUs), product CRUD, image management, variant/inventory management, order list + order detail with status updates

**ASK MEHRAÉ (AI Shopping Assistant)**
- Floating concierge on desktop, full-drawer on mobile
- Retrieval-grounded: every user message triggers a real Supabase query first; only the retrieved products are ever shown to Gemini
- Gemini is used purely as the reasoning/conversation layer and must return structured JSON (`{ message, recommendations: [{ productId, reason }] }`)
- Every `productId` Gemini returns is validated against the retrieved set server-side; anything Gemini invents is silently discarded before the response ever reaches the client
- If nothing suitable exists in the catalogue, the assistant says so rather than fabricating a product
- Works without a Gemini key too (degrades to showing matching real products with a generic message), so the storefront is fully functional even before AI is configured

---

## Tech Stack

- **Next.js 16** (App Router, Server Components, Route Handlers)
- **TypeScript**, strict mode
- **Tailwind CSS v4**
- **Framer Motion** for scroll/reveal interactions
- **Supabase** - Postgres, Auth, Row Level Security, Postgres functions (RPC)
- **Google Gemini API** (`@google/generative-ai`) - server-side only
- **Zod** for validation

No MongoDB, Firebase, Cloudinary, or Stripe are used anywhere in this project.

---

## Architecture

```
Browser
  |
  |-- Server Components (app/**)  ---------->  Supabase (cookie-bound client, RLS enforced)
  |
  |-- Route Handlers (app/api/**) ---------->  Supabase (server client for reads,
  |                                             admin/service-role client for
  |                                             privileged writes, after an
  |                                             explicit requireAdmin()/requireUser()
  |                                             check)
  |
  `-- ASK MEHRAE (app/api/ai) -------------->  1. Supabase retrieval (grounding)
                                               2. Gemini (JSON-only reasoning)
                                               3. Server-side validation of
                                                  every returned productId
                                               4. Trusted DB product data
                                                  returned to the client
```

Key files:
- `lib/supabase/client.ts` / `server.ts` / `admin.ts` - the three Supabase client tiers (browser/publishable, server/cookie-bound, admin/service-role)
- `lib/supabase/auth.ts` - `requireUser()` / `requireAdmin()`, the single source of truth for role checks
- `supabase/migrations/0003_functions.sql` - the atomic `place_order` checkout function
- `lib/ai/retrieval.ts` + `lib/ai/assistant.ts` - the ASK MEHRAÉ grounding + validation pipeline

---

## Environment Variables

Copy `.env.example` to `.env.local` (already present with empty placeholders) and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
GEMINI_API_KEY=
```

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - from your Supabase project's **Settings -> API**. Safe for the browser.
- `SUPABASE_SECRET_KEY` - your Supabase **service_role** key. **Server-only.** Never referenced from any client component.
- `GEMINI_API_KEY` - from Google AI Studio. **Server-only.**

The app is written to fail gracefully (not crash the whole site) if these are unset, so you can still browse the UI shell before wiring up Supabase.

---

## Supabase Setup

1. Create a new Supabase project.
2. In the SQL editor (or via the Supabase CLI), run the migrations **in order**:
   ```
   supabase/migrations/0001_schema.sql
   supabase/migrations/0002_rls.sql
   supabase/migrations/0003_functions.sql
   supabase/migrations/0004_admin_setup.sql
   supabase/migrations/0005_newsletter.sql
   ```
   Or, with the Supabase CLI installed and linked to your project:
   ```bash
   supabase db push
   ```
3. Seed the real MEHRAÉ catalogue (16 products built from the actual supplied images, 51 variants, 2 coupons):
   ```
   supabase/seed.sql
   ```
   **Run this via the CLI or `psql`, not by pasting into the Dashboard SQL Editor.** The file is ~570 lines; large pastes into the Dashboard editor are the most common way a quote gets truncated mid-paste, which then surfaces as a confusing unrelated parse error further down the file. Also note the Dashboard editor does not reload from disk/git - if you previously pasted an older copy into a saved query tab, re-select-all and re-paste the current file content before running it again.

   Using the Supabase CLI (get your project ref from the Dashboard URL or `supabase projects list`):
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db query --linked -f supabase/seed.sql
   ```
   Or directly with `psql`, using the connection string from **Project Settings → Database → Connection string** (URI format):
   ```bash
   psql "postgresql://postgres:[PASSWORD]@db.<your-project-ref>.supabase.co:5432/postgres" -f supabase/seed.sql
   ```
   The seed is wrapped in a single transaction with a preflight check (fails fast with a clear message if migrations haven't been run yet) and a post-seed sanity check, and is safe to run more than once - it upserts by slug/SKU/code rather than duplicating rows.
4. Copy your project's URL and keys into `.env.local` as above.

### Admin Setup

There is deliberately **no way to become an admin from the browser** - a signed-up user can never set their own role, by RLS policy. To promote an account to admin:

1. Sign up for a normal account through the app at `/signup`.
2. In the Supabase SQL editor (which runs with full project privileges), run:
   ```sql
   select public.promote_to_admin('you@example.com');
   ```
3. Sign out and back in. You'll now see an **Admin** link in the navbar and can reach `/admin`.

`promote_to_admin` is only executable by the `service_role` - it cannot be called from the authenticated/anon roles the app uses, so this can't be triggered by a client request.

### Admin Dashboard

Once your account is promoted (above), sign in and open `/admin` (also linked from the navbar and `/account` for admins).

**Authorization is enforced in three independent layers**, all server-side, none trusting anything the browser sends:
1. `proxy.ts` (middleware) looks up the caller's real session and their `profiles.role` row before allowing `/admin/*` to load at all; anyone else is redirected.
2. `app/admin/layout.tsx` re-checks the same thing itself, so it isn't relying solely on the middleware config.
3. Every `/api/admin/*` route calls `requireAdmin()`, which looks up the role fresh from the database using the verified session - never a client-supplied field - and only then uses the service-role client to write.

A signed-up customer account cannot reach any admin page or admin API, regardless of what it sends.

**What you can do from the dashboard:**
| Area | Route | Capabilities |
|---|---|---|
| Overview | `/admin` | Order count, revenue, active product count, low-stock count, recent orders |
| Products | `/admin/products` → `/admin/products/[id]` | Create, edit, activate/deactivate; manage images (add/remove/edit alt text - references files already in `public/`, no upload feature); manage variants (add SKU/color/size, edit price/stock, activate/deactivate) |
| Orders | `/admin/orders` → `/admin/orders/[id]` | Full order detail (customer, shipping address, line items, totals) with a status dropdown (Pending → Confirmed → Processing → Shipped → Delivered, or Cancelled) |
| Inventory | `/admin/inventory` | SKUs at 3 units or fewer, linking straight to that product's edit page |

**To test it:** promote your own account, sign in, place a test order as that same account (or a second test account) using a simulated payment, then confirm it appears in `/admin/orders` and that its status can be updated from there.

---

## Local Development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

Useful scripts:
```bash
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run build        # production build
npm run start        # run the production build
```

All three (`lint`, `typecheck`, `build`) currently pass clean against this codebase.

---

## AI Architecture (ASK MEHRAÉ)

```
User message
  |
  v
/api/ai (Route Handler)
  |
  v
lib/ai/retrieval.ts   -- queries Supabase for active products matching
  |                      occasion/colour/price heuristics extracted from
  |                      the message (falls back to keyword search, then
  |                      featured products) - this is the ONLY product data
  |                      Gemini will ever see
  v
lib/ai/assistant.ts   -- sends the trimmed, retrieved product context +
  |                      system prompt (lib/ai/systemPrompt.ts) to Gemini,
  |                      requesting a strict JSON response
  v
Validation            -- every recommended productId is checked against the
  |                      retrieved set; anything not present is discarded
  v
Trusted response       -- full product data is re-attached from Supabase
                          (never from Gemini's output) before being sent to
                          the client
```

If `GEMINI_API_KEY` is not set, the endpoint still returns real, retrieved products with a generic message, so the storefront never breaks - it just loses the conversational styling layer until a key is added.

---

## Payment

**Payment is simulated for this assignment. No Stripe or real payment gateway is implemented.** Checkout offers "Simulate Successful Payment" and "Simulate Failed Payment." A simulated failure never deducts inventory or creates a paid order; a simulated success runs the full atomic order-placement flow.

---

## Deployment (Vercel)

1. Push this repository to GitHub/GitLab/Bitbucket.
2. Import it into Vercel.
3. Add the four environment variables from `.env.example` in the Vercel project settings.
4. Deploy. Next.js's App Router, Route Handlers and Server Components all run natively on Vercel with no extra configuration.

## Demo Accounts

No credentials are hardcoded anywhere in this repository. Create your own account at `/signup`, and promote it to admin using the SQL command in **Admin Setup** above.
