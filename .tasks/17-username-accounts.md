# Username and password accounts

The owner requested username/password signup and sign-in without confirmation
emails after their confirmation message failed to arrive. Preserve Supabase
password handling, memory-only sessions, save formats, guest saves and owner RLS.

- Usernames are 3–24 ASCII letters, numbers or underscores, trimmed and lowercased.
- Map that canonical username to `<username>@players.psychocept.org` only inside
  the Auth adapter. Supabase's unique email identity enforces username uniqueness.
  The address is an internal identifier, not a deliverable mailbox.
- Disable Confirm email in the project before enabling production username signup.
  Do not create a custom password table, grant public save access, or put an
  administrative key in the browser. Keep Supabase signup/login rate limits.
- Do not expose the internal address in the UI. Explain the absence of email
  recovery before signup. Duplicate names and invalid credentials have useful errors.
- Existing email identities and their saves remain untouched; new usernames are
  separate accounts. This project currently has one unconfirmed email signup.
- Verify canonicalization, invalid input, real SDK requests, immediate signup,
  duplicate names, wrong passwords, cloud saves, sign-out and fresh-browser login.
  Run TypeScript, Vitest, browser checks and a production build before publishing.

Shipped as 1.2.0 (`v1.2.0`, source `385e718`, Pages `08cec2f`). The owner disabled
Confirm email and the public settings verify it. Validation: 1,028 tests, tsc,
clean release build, audit zero vulnerabilities, isolated browser errors/sync/
responsive flows, and real signup, autosave and fresh-browser restoration.
The hydration check found programmatic audio edits and order-dependent default
settings comparison; both have regression coverage and are fixed. The temporary
live account and its saves were deleted, with zero remaining fixtures verified.
The live site displays username/password signup without JS errors. Source PR #1
remains draft for independent review.
