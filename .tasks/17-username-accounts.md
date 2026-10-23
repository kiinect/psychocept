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
