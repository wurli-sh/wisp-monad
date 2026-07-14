# 2E test results

- Email template unit test preserves the exact `/claim#p=...` fragment, rejects query/non-HTTPS links, and has no tracking markup
- Claim payload schema, note-hash recomputation, and exact log binding compile/test; live delivery awaits a real project-owned recipient
- Configured Resend API key is checked by `pnpm preflight:phase2`; live send remains part of the exit gate
