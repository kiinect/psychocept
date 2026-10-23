# Changelog

## 1.2.0 — 2026-10-23

- Create an account and sign in with a username and password, without email.
- Accept usernames without regard to capitalization and explain password recovery limits.
- Preserve cloud saves, guest play and separate progress for each account.
- Restore cloud preferences on a fresh browser without treating loaded audio settings as new local edits.

Previous email accounts remain separate. Create a username account to use the new flow.

## 1.1.0 — 2026-10-23

- Add optional email/password accounts and cloud autosave through Supabase.
- Preserve guest progress and separate local saves for each account.
- Offer a device/cloud choice when meaningful progress conflicts.
- Retry offline saves and protect cloud writes against concurrent changes.
- Add an account screen and save status indicator.

Sign-in lasts until the page is refreshed or closed. Local progress is retained.
