# Go-live checklist — taking real payments

The code needs **zero changes** to take real money: the same checkout, portal,
quantity-sync, and switch-to-group endpoints run live once given live
credentials. Everything below is Stripe-side and environment setup.

Status when this was written (2026-07-23): account `acct_1TiLDvLwodcZQ6Bi` has
`charges_enabled: False` — step 1 has not been completed yet.

Check current status any time:

```bash
docker compose -f local.yml exec django python manage.py shell -c "
import stripe
from reptruly.billing.utils import set_stripe_api_key
set_stripe_api_key()
a = stripe.Account.retrieve()
print('charges_enabled:', a.get('charges_enabled'))
print('payouts_enabled:', a.get('payouts_enabled'))
print('currently_due:', (a.get('requirements') or {}).get('currently_due'))
"
```

---

## 1. Activate the Stripe account  *(only the account owner can do this)*

At [dashboard.stripe.com](https://dashboard.stripe.com) → **Activate payments**:

- Business type + details (sole proprietor is fine)
- Identity verification (government ID)
- Bank account for payouts
- Public business description + website — Stripe checks the site exists, so
  deploy reptruly.com first or point to an existing page

Done when the status check above shows `charges_enabled: True` and
`payouts_enabled: True`. Usually instant to a few hours.

## 2. Rotate any secrets that ever hit git history

`backend/.envs/` was tracked in git until 2026-07-19 and the repo has a GitHub
remote. Local values were rotated then; before going live confirm production
uses fresh values for:

- [ ] `DJANGO_SECRET_KEY`, `DJANGO_ADMIN_URL`, `DJANGO_SUPERUSER_PASSWORD`
- [ ] `CELERY_FLOWER_USER` / `CELERY_FLOWER_PASSWORD`
- [ ] reCAPTCHA key pair (re-key at google.com/recaptcha/admin — the old
      private key is burned)
- [ ] If the production `admin` user already exists in the DB, change its
      password on the server: `python manage.py changepassword admin`
      (the env var only applies at first creation)

## 3. Fill the production env

Copy `backend/.envs.example/.production/` → `backend/.envs/.production/` (kept
out of git) and set:

- [ ] `STRIPE_LIVE_MODE=true`
- [ ] `STRIPE_LIVE_SECRET_KEY=sk_live_…` and `STRIPE_LIVE_PUBLIC_KEY=pk_live_…`
      (Dashboard → Developers → API keys, with **live mode** toggled on)
- [ ] `DOMAIN_NAME=https://reptruly.com` (Stripe return URLs)
- [ ] Everything else marked `!!!Set …!!!` (email host, AWS, Sentry, Postgres)

## 4. Create live prices for Pro

Test-mode products/prices do **not** carry over to live mode.

- [ ] Dashboard (live mode) → Products → create **reptruly Pro** with two
      recurring prices: **$29.99 / month** and **$299.90 / year**
- [ ] Make them visible to the app — either:
  - sync into dj-stripe on the server:
    `python manage.py djstripe_sync_models Price Product`, or
  - pin explicitly via env/settings: `STRIPE_PRO_PRICE_ID=price_…` and
    `STRIPE_PRO_ANNUAL_PRICE_ID=price_…` (checked first; otherwise the app
    picks the first active price per interval — fine when Pro prices are the
    only ones)
- [ ] **Group needs nothing** — the $15/property price is created
      automatically on first Group checkout (idempotent via lookup key
      `reptruly_group_month`)

## 5. Register the production webhook

The handlers (payment failed, subscription ended, trial ending emails) are
already written; dj-stripe serves the endpoint.

- [ ] On the server create the endpoint record:
      `python manage.py shell -c "from djstripe.models import WebhookEndpoint"`
      — or simplest: Django admin → dj-stripe → Webhook endpoints → add, which
      gives a URL of the form `https://reptruly.com/stripe/webhook/<uuid>/`
- [ ] Add that URL in Stripe Dashboard (live mode) → Developers → Webhooks,
      subscribing at least to: `invoice.payment_failed`,
      `customer.subscription.deleted`, `customer.subscription.trial_will_end`,
      `checkout.session.completed`, `customer.subscription.updated`
- [ ] Note: checkout works even before this step — the app syncs the
      subscription on the checkout return redirect (`/api/billing/confirm`).
      Webhooks make failure/cancellation handling robust, so don't skip them.

## 6. Configure the customer portal (live mode, one-time)

- [ ] Dashboard (live mode) → Settings → Billing → Customer portal → save the
      default config (cancel at period end ON, payment-method update ON).
      The portal API returns an error until this is saved once.

## 7. Verify end to end with a real card

- [ ] Deploy with the live env; confirm `https://reptruly.com` serves over
      HTTPS (SSL redirect + HSTS are already in production settings)
- [ ] Sign up with a fresh account, connect a property, upgrade to Pro with a
      real card — ideally your own, then refund it from the Stripe dashboard
- [ ] Confirm: Settings → Billing shows the plan; Stripe dashboard shows the
      subscription with the right quantity; adding/removing a property adjusts
      the quantity (prorated) on the next invoice
- [ ] Cancel via "Manage billing" and confirm the portal loads and the
      subscription is set to cancel at period end

## 8. After launch

- [ ] Watch Dashboard → Payments for the first real charges and any disputes
- [ ] `STRIPE_TEST_*` keys can stay set — test mode remains usable for local
      dev against the same account
- [ ] Revisit `docs/ROADMAP.md` P0s that interact with billing (hourly Pro
      sync) once revenue starts
