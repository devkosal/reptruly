"""Transactional email helpers.

Every send here is best-effort (``fail_silently=True``): an SMTP outage must
never fail the signup, billing, or sync flow that triggered the email.
Locally the console backend prints these to the django container log;
production sends through Amazon SES (see config/settings/production.py).
"""
import logging

from django.core.mail import mail_admins, send_mail

from reptruly.users.models import Preferences, User

logger = logging.getLogger(__name__)

# overall_score is normalized to a 0-10 scale across OTAs; <= 4.0 is roughly
# a 1-2 star review — the "urgent: negative reviews" alert threshold.
NEGATIVE_SCORE_MAX = 4.0


def get_preferences(user: User) -> Preferences:
    prefs, _ = Preferences.objects.get_or_create(user=user)
    return prefs


def send_welcome_email(user: User, origin: str = "") -> None:
    """Welcome + email-confirmation message sent right after signup.

    ``origin`` (scheme://host of the request) makes the confirm link
    absolute; without it the link is omitted (e.g. from scripts).
    """
    if not user.email:
        return
    from reptruly.users.verification import make_token

    name = user.name or user.username
    confirm_block = ""
    if origin:
        confirm_block = (
            "First, please confirm this email address so alerts and digests "
            "reach you:\n\n"
            f"  {origin}/api/auth/verify-email?token={make_token(user)}\n\n"
            "The link is valid for 3 days — you can request a new one from "
            "your dashboard anytime.\n\n"
        )
    send_mail(
        subject="Welcome to reptruly — confirm your email",
        message=(
            f"Hi {name},\n\n"
            "Your reptruly account is ready.\n\n"
            + confirm_block +
            "Two quick steps and you're live:\n\n"
            "  1. Complete your profile\n"
            "  2. Connect your first property — paste any Booking.com, Expedia,\n"
            "     or Google Maps URL and reviews start syncing within a minute\n\n"
            "Head to your dashboard to get started.\n\n"
            "— The reptruly team"
        ),
        from_email=None,  # DEFAULT_FROM_EMAIL
        recipient_list=[user.email],
        fail_silently=True,
    )


def send_verification_email(user: User, origin: str) -> None:
    """Standalone confirm-your-email message (the resend flow)."""
    if not user.email or not origin:
        return
    from reptruly.users.verification import make_token

    send_mail(
        subject="Confirm your reptruly email",
        message=(
            f"Hi {user.name or user.username},\n\n"
            "Click to confirm this email address so alerts and digests "
            "reach you:\n\n"
            f"  {origin}/api/auth/verify-email?token={make_token(user)}\n\n"
            "The link is valid for 3 days.\n\n"
            "— The reptruly team"
        ),
        from_email=None,
        recipient_list=[user.email],
        fail_silently=True,
    )


def send_negative_review_alert(property_obj, reviews) -> None:
    """One summary email per sync run listing newly arrived negative reviews."""
    if not reviews:
        return
    user = property_obj.user
    prefs = get_preferences(user)
    if not prefs.notify_negative_reviews or not prefs.alert_recipient:
        return
    lines = []
    for r in reviews[:10]:
        snippet = (r.content or "(no text)").strip().replace("\n", " ")
        if len(snippet) > 140:
            snippet = f"{snippet[:140]}…"
        lines.append(f"  • {r.overall_score}/10 on {r.ota_name}: {snippet}")
    if len(reviews) > 10:
        lines.append(f"  … and {len(reviews) - 10} more")
    count = len(reviews)
    send_mail(
        subject=(
            f"⚠ {count} negative review{'s' if count != 1 else ''} "
            f"for {property_obj.property_name}"
        ),
        message=(
            f"Hi {user.name or user.username},\n\n"
            f"The latest sync brought in {count} new "
            f"review{'s' if count != 1 else ''} scoring "
            f"{NEGATIVE_SCORE_MAX}/10 or below for "
            f"{property_obj.property_name}:\n\n"
            + "\n".join(lines)
            + "\n\nGuests read your replies — responding fast to negative "
            "reviews is the highest-impact move. Open your review inbox to "
            "reply.\n\n— reptruly alerts"
        ),
        from_email=None,
        recipient_list=[prefs.alert_recipient],
        fail_silently=True,
    )
    logger.info(
        "Negative review alert sent for %s (%d reviews)",
        property_obj.property_name,
        count,
    )


def send_daily_digest_email(user: User, recipient: str, stats: dict) -> None:
    """Morning digest: what arrived in the last 24h. Caller skips quiet days."""
    lines = [
        f"  • {p['name']}: {p['count']} new "
        f"(avg {p['avg']}/10{', ' + str(p['negatives']) + ' negative' if p['negatives'] else ''})"
        for p in stats["properties"]
        if p["count"]
    ]
    send_mail(
        subject=(
            f"Daily digest: {stats['total']} new "
            f"review{'s' if stats['total'] != 1 else ''} overnight"
        ),
        message=(
            f"Hi {user.name or user.username},\n\n"
            f"Since yesterday you received {stats['total']} new "
            f"review{'s' if stats['total'] != 1 else ''} "
            f"(average score {stats['avg']}/10, {stats['negatives']} negative):\n\n"
            + "\n".join(lines)
            + "\n\nOpen your review inbox to read and reply.\n\n— reptruly digests"
        ),
        from_email=None,
        recipient_list=[recipient],
        fail_silently=True,
    )


def send_weekly_summary_email(user: User, recipient: str, stats: dict) -> None:
    """Monday recap of the previous 7 days across all properties."""
    ota_lines = [
        f"  • {ota}: {count}" for ota, count in stats["by_ota"].items()
    ] or ["  • No new reviews this week"]
    send_mail(
        subject=f"Your week on reptruly: {stats['total']} new reviews",
        message=(
            f"Hi {user.name or user.username},\n\n"
            "Here's last week across "
            f"{stats['property_count']} "
            f"propert{'ies' if stats['property_count'] != 1 else 'y'}:\n\n"
            f"  • New reviews: {stats['total']}"
            + (f" (average {stats['avg']}/10)" if stats["total"] else "")
            + f"\n  • Negative (≤{NEGATIVE_SCORE_MAX}/10): {stats['negatives']}\n"
            f"  • Reply rate on new reviews: {stats['reply_rate']}%\n\n"
            "By channel:\n" + "\n".join(ota_lines)
            + "\n\nSee the full picture in Analytics.\n\n— reptruly digests"
        ),
        from_email=None,
        recipient_list=[recipient],
        fail_silently=True,
    )


def send_payment_failed_email(user: User, amount_cents: int | None, currency: str) -> None:
    """Dunning: a renewal charge failed — ask the user to update their card."""
    if not user.email:
        return
    amount = (
        f" of {_money(amount_cents / 100, currency)}" if amount_cents else ""
    )
    send_mail(
        subject="Action needed: your reptruly payment failed",
        message=(
            f"Hi {user.name or user.username},\n\n"
            f"We couldn't process your reptruly Pro payment{amount}. "
            "Stripe will retry automatically over the next few days, but to "
            "keep Pro features running please update your payment method:\n\n"
            "  Settings → Billing & plan → Manage billing\n\n"
            "If the retries fail, your account drops back to the Starter plan "
            "(your data is kept).\n\n— The reptruly team"
        ),
        from_email=None,
        recipient_list=[user.email],
        fail_silently=True,
    )
    mail_admins(
        subject=f"Payment failed: {user.name or user.username}",
        message=(
            f"Stripe reported a failed payment for {user.email or user.username} "
            f"(user id {user.id})."
        ),
        fail_silently=True,
    )


def send_subscription_ended_email(user: User) -> None:
    if not user.email:
        return
    send_mail(
        subject="Your reptruly Pro subscription has ended",
        message=(
            f"Hi {user.name or user.username},\n\n"
            "Your Pro subscription has ended and your account is back on the "
            "Starter plan (1 property, Booking.com sync). Your properties and "
            "review history are untouched.\n\n"
            "You can re-subscribe anytime from Settings → Billing & plan.\n\n"
            "— The reptruly team"
        ),
        from_email=None,
        recipient_list=[user.email],
        fail_silently=True,
    )


def send_trial_ending_email(user: User, amount_cents: int | None, currency: str, interval: str | None) -> None:
    """Heads-up 3 days before the trial converts to a paid subscription."""
    if not user.email:
        return
    charge = ""
    if amount_cents:
        charge = f" and your card will be charged {_money(amount_cents / 100, currency)}"
        if interval:
            charge += f" per {interval}"
    send_mail(
        subject="Your reptruly Pro trial ends in 3 days",
        message=(
            f"Hi {user.name or user.username},\n\n"
            f"Your 14-day Pro trial ends in 3 days{charge}.\n\n"
            "Want to stay? Do nothing — Pro continues uninterrupted.\n"
            "Not for you? Cancel in under a minute from Settings → "
            "Billing & plan → Manage billing, and you won't be charged.\n\n"
            "— The reptruly team"
        ),
        from_email=None,
        recipient_list=[user.email],
        fail_silently=True,
    )


def _money(amount: float, currency: str) -> str:
    value = f"{amount:,.2f}"
    if value.endswith(".00"):
        value = value[:-3]
    symbol = {"USD": "$", "EUR": "€", "GBP": "£"}.get(currency.upper())
    return f"{symbol}{value}" if symbol else f"{value} {currency.upper()}"


def send_rate_opportunity_email(user: User, recipient: str, opportunities: list[dict]) -> None:
    """Very-high-demand dates where the property is priced below its comp set."""
    if not opportunities:
        return
    lines = []
    for o in opportunities:
        day = o["date"]
        cur = o.get("currency") or "USD"
        comp = f" vs comp average {_money(o['comp_avg'], cur)}" if o.get("comp_avg") else ""
        lines.append(
            f"  • {day} — demand {o['demand_score']}/5 ({o['drivers']})\n"
            f"    {o['property_name']}: your rate {_money(o['user_rate'], cur)}"
            f"{comp} ({o['vs_avg_pct']:+.0f}%)"
        )
    count = len(opportunities)
    send_mail(
        subject=(
            f"Pricing opportunity: {count} high-demand "
            f"date{'s' if count != 1 else ''} where you're below market"
        ),
        message=(
            f"Hi {user.name or user.username},\n\n"
            "Demand is spiking on these upcoming dates and your nightly rate "
            "is at least 10% below your comp set:\n\n"
            + "\n\n".join(lines)
            + "\n\nConsider raising your rate for these dates — check the "
            "Rates page for the full competitor breakdown.\n\n"
            "You get this because rate alerts are on in Settings → "
            "Notifications.\n\n— reptruly alerts"
        ),
        from_email=None,
        recipient_list=[recipient],
        fail_silently=True,
    )


def send_monthly_report_email(
    user: User, recipient: str, month_label: str, properties: list[dict]
) -> None:
    """First-of-month owner report: last month's numbers per property with a
    deep link to the printable report for each."""
    if not properties:
        return
    blocks = []
    for p in properties:
        stats_line = (
            f"    {p['total']} review{'s' if p['total'] != 1 else ''}"
            + (f" · average {p['avg']}/10" if p["total"] else "")
            + (f" · {p['negatives']} negative" if p["negatives"] else "")
            + (f" · reply rate {p['reply_rate']}%" if p["total"] else "")
        )
        blocks.append(
            f"  {p['name']}\n{stats_line}\n"
            f"    Full report (print to PDF): {p['report_url']}"
        )
    send_mail(
        subject=f"Your {month_label} report is ready",
        message=(
            f"Hi {user.name or user.username},\n\n"
            f"Here's how {month_label} went:\n\n"
            + "\n\n".join(blocks)
            + "\n\nEach link opens the owner-ready report — use your browser's "
            "Download PDF button to save or forward it.\n\n"
            "— reptruly reports"
        ),
        from_email=None,
        recipient_list=[recipient],
        fail_silently=True,
    )


def send_pro_subscription_emails(user: User) -> None:
    """Notify the subscriber and the admins about a new Pro subscription."""
    name = user.name or user.username
    if user.email:
        send_mail(
            subject="Welcome to reptruly Pro",
            message=(
                f"Hi {name},\n\n"
                "Your reptruly Pro subscription is now active. Pro unlocks:\n\n"
                "  • Up to 10 properties\n"
                "  • Booking.com + Expedia + Google review sync\n"
                "  • AI summaries and reply drafting\n"
                "  • Rate shopping vs. your comp set\n\n"
                "Manage your plan, payment method, and invoices anytime from "
                "Settings → Billing & plan.\n\n"
                "— The reptruly team"
            ),
            from_email=None,
            recipient_list=[user.email],
            fail_silently=True,
        )
    mail_admins(
        subject=f"New Pro subscriber: {name}",
        message=(
            f"{name} ({user.email or 'no email'}, user id {user.id}) "
            "just subscribed to Pro via Stripe Checkout."
        ),
        fail_silently=True,
    )
