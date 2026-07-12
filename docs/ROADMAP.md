# reptruly — Product Audit & Prioritized Roadmap

_Audit date: 2026-07-05. Read-only audit of `backend/` (Django + django-ninja) and `frontend/` (React SPA)._

---

## 1. Current state by feature area

### Reviews (unified inbox)
The strongest area. Booking.com syncs fully and incrementally via RapidAPI (`reviews/rapidapi/client.py`, `reviews/tasks.py`) with early-break on known review IDs; Expedia syncs via the Hotels.com Provider RapidAPI (gracefully skipped when the RapidAPI plan is not subscribed); Google syncs via Places API (New) but is hard-capped at **5 reviews per property** — Google's own limit on Place Details (`reviews/google/client.py:299`). The inbox (`frontend/src/pages/Reviews.tsx`) has real filters (OTA chips with counts, score range, dates, full-text search, reply status), a detail modal, and drill-down URLs from Analytics. Replying is **deep-link only**: buttons open the Booking extranet / Expedia Partner Central / Google Business Profile in a new tab. An AI draft panel (OpenAI gpt-4o-mini via `POST /api/reviews/{id}/draft-reply`) generates a tone/language/signature-aware reply, editable inline, with "Copy & open OTA" — but the user pastes manually; there is no write-back. `Review.tags` and `Review.scores` are always empty lists. A legacy Channex client + task exist but nothing triggers them.

### Rates (comp shopping)
Live and on-demand only. `GET /api/rates/{property_id}` (`reviews/api/controllers.py:1008`) fetches the property's own rate and a nearby comp set from Booking.com via RapidAPI, computes vs-average %, and caches 24h per (property, dates, adults). No rate data is ever persisted — the daily `sync_rates_daily` celery task is an explicit stub (`core/sync_tasks.py` `_do_rates` returns 0). Consequences: no rate history, no trend charts, and the "rate movement alerts" toggle in Settings can never fire.

### Demand calendar
Works on-demand: `GET /api/calendar/{property_id}` (`events/api/controllers.py`) merges Ticketmaster events (paginated, radius search), Open-Meteo weather (16-day cap), and the `holidays` library, then scores each day 0–5. A nice touch: events are impact-classified 0–3 by gpt-4o-mini with a 30-day Redis cache (`events/classifier.py`). No persistence model exists (`sync_calendar_daily` is a stub), results cache 24h. Country detection for holidays is string-matching that only knows US/GB/CA and defaults to US — wrong holidays for most of the world.

### Analytics
Summary and trends are real, well-optimized SQL (conditional aggregates, composite indexes on `Review`). AI summary (positives/problems by category) and AI topic scoring (10 topics, 0–10, priority ranking) call OpenAI on-demand; topics cache 24h keyed by a review-sample hash. `sync_analytics_daily` is a stub — nothing is precomputed, everything is request-time.

### Billing
Stripe Checkout, `/billing/status`, `/billing/confirm` (session-id based, no webhook), and customer portal all work (`billing/api/controllers.py`). Plan = "Pro" iff an active/trialing dj-stripe subscription exists. **Zero feature gating exists anywhere**: free users get unlimited properties, all three OTAs, rates, and every AI feature. Checkout always charges quantity 1 regardless of property count, though Pricing says "per property / month". `billing/models.py` (Cart/Order/OrderItem/local Subscription) is unused boilerplate. The beat schedule script registers `reptruly.billing.tasks.post_usage_charges_to_stripe` **hourly, but that task does not exist** (`billing/tasks.py` only has `sample_force_task`) — an unregistered-task error every hour if the script has been run.

### Onboarding
Signup is username/email/password (`users/api/controllers.py`), session auth, no email verification. Connect-property flow is genuinely good: paste a Booking/Expedia/Google URL (or search Google Places by name), IDs are extracted, metadata/geo fetched, and the initial review sync runs inline so the inbox is populated immediately (`PropertiesAPI.create_property`). Property edit supports adding/removing OTA links with review cleanup. Profile page persists to the backend; Settings mostly does not (see below).

### Data freshness: what actually syncs daily
Celery beat (DatabaseScheduler, seeded by `backend/scripts/add_scheduled_tasks.py`) runs four staggered daily tasks at 03:00–03:45 UTC. Only **reviews** does real work; rates/calendar/analytics record a success heartbeat and sync nothing — so the "Updated 2h ago" dots in Settings → Manual sync are technically lying for three of four domains. Manual "Sync now" per domain exists (`core/api/sync_controller.py`). Rates and calendar data freshness is really "24h request cache". Note: `CELERY_TASK_SOFT_TIME_LIMIT = 60` seconds — a multi-property, multi-OTA review sync can plausibly blow past this.

---

## 2. Promise gaps (marketing claims that are not yet true), ranked by embarrassment

1. **"Up to 10 properties" (Pro) / "1 property" (Starter)** — no property limit is enforced anywhere. Free users can add unlimited properties. This is revenue leaking out the door, and the moment you enforce it retroactively you will break existing free accounts.
2. **"Hourly review refresh" on Pro** (Pricing + Home stats strip "Hourly on Pro plans") — the only schedule is daily 03:00 UTC. Settings even labels hourly "coming soon" while the paid marketing page sells it as live. A paying Pro customer can verify this is false in one day.
3. **Starter = "Booking.com review sync" only; Pro = "Booking + Expedia + Google"** — every plan syncs all three OTAs today. Nothing distinguishes what Pro buyers pay for besides a badge.
4. **Notification toggles that send nothing** — Settings promises new-review emails, negative-review instant alerts, daily digest, weekly summary, rate-movement alerts, sync-failure alerts. There is no email-sending code in the entire backend (`send_mail` appears nowhere). All toggles write to localStorage only.
5. **Group tier fiction** — "API access", "Custom OTA integrations", "99.9% SLA", "Dedicated success manager", "Unlimited properties", "$15/property volume pricing": none exist in billing or code. Acceptable-ish for a contact-sales tier, but "API access" is a concrete checkable claim.
6. **Home feature pills that do not exist**: Auto-Tags (TAG), Sentiment (SEN), Reply SLA (SLA), CSV Export (EXP), "Saved filters per user" (SRC), "Templates for 1-star, 5-star" (Reply Studio), "Per-property permissions on Pro+" (MPR). The pills section says "everything ships on day one, no add-ons" — seven of eighteen pills are vapor.
7. **"Every Google review in one timeline"** — Google is capped at the 5 most recent reviews per property (API limit). A hotel with 800 Google reviews sees 5. Needs either the Google Business Profile API (OAuth, owner-verified) or honest copy.
8. **Pricing math**: page says "$29 per property / month" but checkout creates a fixed quantity-1 subscription (~$29.99/mo flat regardless of properties). "Pay annually for 2 months free" and "annual plans get pro-rated refunds" — no annual price exists.
9. **"Auto-send for 5-star reviews" (Pro badge) and the 2FA toggle** — both are inert localStorage switches; auto-send is impossible anyway since no OTA write-back exists.
10. **"AI summaries refresh whenever new reviews land"** — they are request-time with a 24h cache; nothing refreshes on new reviews.

---

## 3. Prioritized roadmap

Effort: S = under a day, M = 2–5 days, L = 1–2+ weeks.

### P0 — Broken promises & revenue blockers

- **P0.1 — Server-side plan entitlements + enforcement (M).** Add a small `billing/entitlements.py` (e.g. `get_plan(user)` returning max_properties, allowed_otas, ai_enabled, sync cadence — derived from `_active_subscription`) and enforce at: property count in `PropertiesAPI.create_property`; OTA links in `create_property` / `update_property` (Starter → Booking only); AI endpoints `draft_reply`, `ai_summary`, `topic_scores`; `RatesAPI.get_rates`. Return limits in `/billing/status` so the UI shows upgrade prompts instead of raw 403s. Grandfather existing over-limit accounts (read-only lock, do not delete).
  Files: `backend/reptruly/billing/api/controllers.py`, new `backend/reptruly/billing/entitlements.py`, `backend/reptruly/reviews/api/controllers.py`, `frontend/src/api/billing.ts`, `frontend/src/pages/ConnectProperty.tsx`, `frontend/src/pages/Pricing.tsx`.
- **P0.2 — Hourly review sync for Pro (M).** Make the headline Pro claim true: add an hourly beat entry that syncs only properties whose owner has Pro; keep daily for everyone. Raise `CELERY_TASK_SOFT_TIME_LIMIT` or fan out per-property (`sync_reviews_for_property.delay`) so long syncs do not hit the 60s soft limit.
  Files: `backend/reptruly/core/sync_tasks.py`, `backend/scripts/add_scheduled_tasks.py`, `backend/config/settings/base.py`.
- **P0.3 — Stripe webhook endpoint (S–M).** Wire dj-stripe webhooks so cancellations/failed payments downgrade users without them revisiting `/settings`. Today plan state only updates via `confirm` or portal round-trips.
  Files: `backend/config/urls.py`, `backend/reptruly/billing/`.
- **P0.4 — Fix the phantom beat task (S).** Remove `post_usage_charges_to_stripe` from the schedule script (or implement it) — it errors hourly. Also delete/park the unused `billing/models.py` commerce boilerplate.
  Files: `backend/scripts/add_scheduled_tasks.py`, `backend/reptruly/billing/tasks.py`.
- **P0.5 — De-lie the marketing pages (S, interim).** Until P0.1–P0.2 ship: drop or "coming soon" the hourly claim, the Starter/Pro OTA split, Group "API access", annual pricing, and the seven vapor feature pills. Cheapest embarrassment fix available.
  Files: `frontend/src/pages/Pricing.tsx`, `frontend/src/pages/Home.tsx`.
- **P0.6 — Scope `GET /api/reviews/{review_id}` to the requesting user (S).** It currently fetches any review by UUID with no ownership check (data-isolation bug; every other endpoint uses `_user_review_qs`).
  Files: `backend/reptruly/reviews/api/controllers.py:135`.

### P1 — Retention features (make the product sticky)

- **P1.1 — Email notifications (M–L), starting with negative-review alerts + weekly summary.** Persist notification prefs server-side, detect new reviews during sync (the upsert already knows created-vs-updated), send via Django email + celery. Makes the daily sync valuable even when users do not log in — the biggest retention lever here.
  Files: new `backend/reptruly/notifications/`, `backend/reptruly/reviews/tasks.py`, `backend/reptruly/core/sync_tasks.py`, `frontend/src/pages/Settings.tsx`.
- **P1.2 — Persist Settings server-side (M).** Move reply prefs (tone/language/signature), notification prefs, and workspace prefs off localStorage so they survive devices and can drive backend behavior (the AI draft already posts prefs per-request — keep that contract, store canonically).
  Files: `backend/reptruly/users/api/controllers.py`, `backend/reptruly/users/models.py`, `frontend/src/pages/Settings.tsx`, `frontend/src/pages/Reviews.tsx`.
- **P1.3 — Rate history + real rates sync (L).** Add a `RateSnapshot` model, implement `_do_rates` to snapshot each property's rate + comp set daily for a rolling window (e.g. next 30 days at 7-day granularity), chart history on the Rates page, and power rate-movement alerts (>10% competitor change → P1.1 pipeline).
  Files: `backend/reptruly/core/sync_tasks.py`, new model (new `rates` app or `reviews`), `frontend/src/pages/Rates.tsx`.
- **P1.4 — "Reply Studio" as marketed (M for templates/pre-gen, L for write-back).** Reply templates (1-star / 5-star / edge cases), auto-suggest drafts on new reviews (pre-generate during sync when `auto_suggest` is on), store drafts on the Review row. True write-back is only feasible via Channex (the scaffolding client already exists) or Google Business Profile OAuth — scope a Channex-backed reply pilot as the long-term path.
  Files: `backend/reptruly/reviews/api/controllers.py`, `backend/reptruly/reviews/channex/client.py`, `frontend/src/pages/Reviews.tsx`.
- **P1.5 — Fix holiday country detection (S).** Derive country from Booking metadata (`meta["country"]`) or Google reverse geocode at property-create time and store it on `Property`, instead of substring-matching the location string (currently US-defaulted worldwide).
  Files: `backend/reptruly/reviews/models.py` (+migration), `backend/reptruly/events/api/controllers.py` (`_country_for_property`).
- **P1.6 — Honest sync status (S).** Stop recording SUCCESS heartbeats for the three stub domains (show "not yet automated" in the UI) until each has a real fetcher.
  Files: `backend/reptruly/core/sync_tasks.py`, `frontend/src/components/SyncFooter.tsx`, `frontend/src/pages/Settings.tsx`.

### P2 — Nice-to-have / expansion

- **P2.1 — CSV export (S)** of the filtered review list (already a marketed pill; trivial endpoint reusing `list_reviews` filters). Files: `backend/reptruly/reviews/api/controllers.py`, `frontend/src/pages/Reviews.tsx`.
- **P2.2 — Auto-tags + sentiment (M):** batch-classify during sync with gpt-4o-mini into the existing (empty) `Review.tags` JSON field; add tag filter chips. Powers the TAG/SEN pills. Files: `backend/reptruly/reviews/tasks.py`, `models.py`, `frontend/src/pages/Reviews.tsx`.
- **P2.3 — Reply SLA metrics (M):** needs replied-at timestamps — start capturing `has_reply` transitions during sync now so data accrues. Files: `backend/reptruly/reviews/tasks.py`, `frontend/src/pages/Analytics.tsx`.
- **P2.4 — Account security (M):** real password change, email verification, session management; remove the dead 2FA toggle until built. Files: `backend/reptruly/users/api/controllers.py`, `frontend/src/pages/Settings.tsx`.
- **P2.5 — Annual price + per-property quantity billing (M):** make "per property / month" arithmetically true; 2-months-free annual. Files: `backend/reptruly/billing/api/controllers.py`, `frontend/src/pages/Pricing.tsx`.
- **P2.6 — Public read API + keys (L):** unblocks the Group tier claim; Airbnb/Channex as a 4th review source; self-serve account deletion. Files: new `backend/reptruly/api_keys/`, `backend/reptruly/reviews/channex/`.

---

## 4. Quick wins under a day

1. **Remove the phantom `post_usage_charges_to_stripe` beat entry** (hourly error noise) — `backend/scripts/add_scheduled_tasks.py:54`.
2. **User-scope `GET /api/reviews/{review_id}`** — one-line fix, closes a data-isolation hole — `backend/reptruly/reviews/api/controllers.py:135`.
3. **Truth-pass on Pricing.tsx / Home.tsx**: hourly → daily wording, delete or "soon"-badge the 7 vapor pills, drop annual-billing FAQ lines, soften "every Google review" to "latest Google reviews".
4. **Minimal property-count gate**: block a second property for non-Pro users in `create_property` + an upgrade CTA in `ConnectProperty.tsx` — the crude version of P0.1 that stops free-tier leakage immediately.
5. **CSV export endpoint** (P2.1) — reuses existing queryset filters, ~50 lines, legitimately deletes one vapor pill.
6. **Store `country` on Property at create time** from Booking metadata (already fetched in `create_property`) so holidays stop defaulting to US for new properties.
7. **Stop success-heartbeats for stub sync domains** so Settings does not claim rates/calendar/analytics "synced" — `core/sync_tasks.py`.
8. **Raise/chunk the 60s `CELERY_TASK_SOFT_TIME_LIMIT`** before it silently truncates the nightly review sync for larger accounts — `backend/config/settings/base.py:214`.
