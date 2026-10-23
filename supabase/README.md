# Account saves

Guest play always uses the existing `mpt.*` localStorage slots. Accounts add an
optional cloud mirror for profiles, settings, the between-round run snapshot, and
its hero/reward bookkeeping. The co-op relay is unchanged.

## Connect a project

1. In your Supabase SQL editor, run `migrations/202610230001_saves.sql` once.
   It creates `public.saves`, four owner-only RLS policies, and the conditional
   `put_save` upsert. Anonymous clients have no table or RPC privileges.
2. In Auth → Sign In / Providers, keep the Email provider enabled and turn
   **Confirm email off**. The owner requested username/password accounts without
   email. Supabase still handles credentials; the adapter maps case-insensitive
   usernames to internal `@players.psychocept.org` identities. These are not
   mailboxes. Confirmation must be disabled before publishing this flow.
3. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` to your project URL and **public anon/publishable**
   key. Never use a service-role/secret key. The `.env.local` file is ignored.
4. Run `npx vite --port 5199 --strictPort`. Open Account from the main menu.
   Create a username account and sign in immediately. Conflicting progress asks
   which device/cloud value to keep. A new account imports guest progress.
5. With a database-owner connection, run `tests/saves_rls.sql`. Its fixtures and
   changes roll back. For example: `psql "$BTD6_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/saves_rls.sql`.
   Also verify with two real test accounts that neither can read/write the other's
   saves, and that a fresh browser can resume the owner's progress.

The production build needs the same two public environment variables at build
time, plus the existing `VITE_RELAY_URL`. Do not publish until live auth/RLS checks
and the repository's peer review have passed and the owner approves deployment.

## Behavior and limits

- Usernames accept 3–24 ASCII letters, numbers or underscores, ignoring case.
  Supabase's email uniqueness enforces the corresponding canonical identity.
  No email is collected and there is no email password recovery. Existing email
  accounts are not renamed or deleted; new usernames create separate identities.
  The UI validates input, but identity uniqueness, passwords, rate limits and
  save authorization remain enforced by Supabase. No public user directory is added.
- Local writes happen first. Cloud writes debounce for 3 seconds and retry from
  1 to 30 seconds after failures. Pending changes and synchronization baselines
  survive reload in `mpt.sync.v1`; each account has a separate local cache.
- On sign-out, the prior guest workspace returns. Guest changes can seed a new
  account; one account's progress never seeds another account. Existing account
  caches resume when that account signs in again.
- Remote envelopes pass strict shape checks and existing slot migrations and
  validators. Unknown/future versions and malformed data cannot replace local
  progress. Object-key order from jsonb does not cause conflicts.
- Newer timestamps decide non-progress differences. Different meaningful progress
  on both sides, including equal/unknown dates, requires a choice. A common last
  synchronized value lets ordinary autosaves proceed without repeated prompts.
- Each upsert compares the expected cloud timestamp atomically. A losing write
  rereads and reconciles instead of overwriting a concurrent update. Slot clears
  upload tombstones, preventing a finished run from being resurrected.
- Round ends, results, page hiding, and reconnect attempt an immediate flush.
  Browsers may cancel requests at page close; durable local pending state is the
  recovery path, and uploads resume after signing back into the same account.
- Auth sessions are **memory-only** on this static site. Refreshing/closing the
  page requires sign-in again; game progress remains durable. HttpOnly persistent
  sessions would require adding a server. No passwords/tokens enter save metadata.
- Saves sync at slot granularity. Profile inventories are not merged field by
  field. The game snapshot and companion bookkeeping have matching `savedAt`
  values; choose a matching pair when resolving their conflicts. A mismatched
  pair uses the game's existing legacy fallback.
- Cross-tab simultaneous gameplay is not coordinated; use one active game tab
  per device. These saves provide continuity, not anti-cheat or server-side game
  validation. Deleting a Supabase auth user cascades that user's cloud saves.

## Verification

`npx tsc --noEmit`, `npx vitest run`, and `npx vite build` are the merge gates.
The focused suites are `src/storage/*.test.ts`. SQL assertions run against the
actual migration with anonymous and two authenticated identities, including
owner CRUD, cross-user denial, tombstones, and stale upserts.

`tools/cloud-browser.mjs` runs isolated Playwright browser checks. Install
`playwright-core` outside the repository, set `PLAYWRIGHT_MODULE` to its module
URL and `CHROMIUM_PATH` to the Chromium executable. Serve an ordinary build at
`http://127.0.0.1:5196`. Build a separate test output with URL
`https://cloud-test.supabase.co` and key `public-test-key`, then serve it at
`:5197`. The script intercepts every test Supabase request; no real account or
email is used. `GUEST_URL`, `CLOUD_URL`, and `SCREENSHOT_DIR` override defaults.

References: [Auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[password authentication](https://supabase.com/docs/guides/auth/passwords).
