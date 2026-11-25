# Supabase backend

Run the SQL migration in `migrations/` and deploy the `game` Edge Function.
The function is intentionally unauthenticated at the platform JWT layer because
players do not create accounts. It uses an unguessable temporary player UUID and
checks membership/host status on every room action. Room codes are six characters.

Security limitations to address before a broad public launch:
- Add per-IP and per-room rate limiting (e.g. an edge gateway/WAF or transactional rate-limit table).
- Use transactional/optimistic concurrency control for simultaneous submissions.
- Consider private Realtime channels with authorization if you replace the current
  change-notification subscription. Clients currently only receive change events
  and fetch state through the function.
- Restrict CORS to your exact production origin.
