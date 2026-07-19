# reptruly Public API (v1)

Read-only API for your reviews data. Authenticate every request with an API key header:

    X-API-Key: <prefix>.<key>

Create keys in the app (Settings → API keys) or via `POST /api/keys` (session-authenticated). The full key is shown exactly once at creation; revoke with `DELETE /api/keys/{prefix}`.

Endpoints (all scoped to the key owner's properties; invalid/revoked keys get `401`):

- `GET /api/v1/properties` — connected properties: `{id, name, location, channels, created_at}`.
- `GET /api/v1/reviews?property_id=&ota_name=&min_score=&max_score=&from_date=&to_date=&page=&limit=` — paginated reviews (`limit` ≤ 100, default 50) as `{data, total, page, limit}`.
- `GET /api/v1/analytics/summary?property_id=` — `{total_reviews, avg_score, replied, pending_reply, by_ota}`.

`property_id` is the UUID returned by `/api/v1/properties`; dates are `YYYY-MM-DD`.
