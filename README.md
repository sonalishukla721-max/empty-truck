# TruckLoad AI

**Don't let your truck return empty.** AI-assisted return-load matching for Indian trucking.

Product loop: **PREDICT → MATCH → BOOK → TRACK → MEASURE**

## Stack

- TanStack Start (React 19 + TypeScript + Vite) — this workspace is a TanStack Start project, not Next.js. Routing lives in `src/routes/` with file-based routes; server logic uses `createServerFn` / server routes instead of Next.js API routes.
- Tailwind CSS v4 + shadcn/ui, Recharts, Lucide, TanStack Query
- Lovable Cloud backend (Postgres + Auth + RLS + Realtime + Storage)

## Database

Full schema, RLS policies, indexes, signup trigger and demo seed data: **`docs/schema.sql`**
(also split into `supabase/migrations/`). It has already been applied to the connected backend.

Tables: `profiles`, `user_roles`, `drivers`, `shippers`, `trucks`, `loads`,
`return_load_opportunities`, `bookings`, `trips`, `payments`, `location_updates`,
`notifications`, `ratings`, `pilot_validation`.

## Authentication

- Email + password sign-up/sign-in at `/auth`, roles `DRIVER | SHIPPER | ADMIN`.
- On signup a database trigger (`handle_new_user`) creates the profile row, the role row
  and the matching driver/shipper record automatically.
- Roles live in a separate `user_roles` table and are checked with the
  `has_role()` security-definer function inside RLS policies (no privilege escalation via profile edits).
- Email confirmation is auto-confirmed so the pilot demo can be walked end to end.
  Leaked-password protection is on — use a strong, unique password.

## Demo journey

1. `/` landing → **Find a return load**
2. Create a driver account → `/driver`
3. Demo truck `RJ14 AB 1234` on Mumbai → Jabalpur, status **EMPTY SOON**
4. **Return load dhundo** → ranked matches (route 30%, distance 25%, capacity 20%,
   timing 10%, price 10%, trust 5% — fully deterministic, in `src/lib/matching.ts`)
5. **Booking request bhejo** → booking row created, load marked matched
6. Sign in as a shipper account → `/shipper` → accept the request (realtime)
7. `/radar` for the corridor view, `/impact` for empty km / fuel / CO₂ estimates
8. `/admin` for network metrics and pilot validation (admin role)

## Honest-by-default

No external provider keys are configured, so voice transcription, maps and payments run in
**demo mode** with clear labels instead of faked API calls. Every impact number is an
estimate from configurable assumptions in `IMPACT_ASSUMPTIONS` (`src/lib/matching.ts`).

## Local development

```bash
npm install
npm run dev
```
