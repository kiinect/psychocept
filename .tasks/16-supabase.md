# Accounts and cloud saves

Implements Part 2 of `/home/kaden/handoff-gpt-vault-and-supabase.md`.
Email/password accounts are optional; guest storage keys and save formats remain compatible.

## Boundaries and build order
1. Storage codecs: decode cloud envelopes through existing migrations/validators; reject invalid input.
2. Cloud mirror: write local storage synchronously, debounce remote writes for 3 seconds,
   retry with capped backoff, persist pending changes, and flush at round boundaries/lifecycle events.
3. Identity adapter: Supabase Auth and an owner-only saves table. Separate account caches;
   guest progress is offered on first sign-in. Never send one account's cache to another.
4. Account screen: sign up/in/out, guest option, status and per-slot conflict choices.

Conflicts compare timestamps and the last synchronized value. Divergent meaningful progress
requires a device/cloud choice; an unknown legacy timestamp cannot silently beat cloud progress.
Clears use tombstones so a completed run does not reappear. Conditional upserts reject stale
writes atomically; rejected writes are reread and reconciled. Unknown/invalid cloud slots do
not overwrite local data. Network failures cannot block gameplay.

The untrusted boundaries are auth forms, cloud JSON, and persisted local metadata. Supabase
handles credentials; the client holds only the public project configuration. RLS governs
every table operation, including the conditional upsert (security invoker). Never deploy,
run production migrations, or update the vault without the user's go-ahead.

## Verification
`npx tsc --noEmit`, `npx vitest run`, `npx vite build`.
Fake-client tests: migrations, malformed remote rejection, debounce, retries/reload,
timestamp ordering, conflicts, guest import, account isolation, clears and stale requests.
Playwright: guest menu/settings/run, auth states, conflict choice, keyboard and responsive UI.
SQL role tests: anonymous denied; owner CRUD; other-user read/write denied; stale upsert denied.

Live configuration remains pending the user's project URL/public anon key, migration,
redirect allow-list, and live RLS verification. Work remains on `lane/supabase` until review.
