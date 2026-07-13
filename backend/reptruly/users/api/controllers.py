from django.contrib.auth import authenticate, get_user_model, login as django_login, logout as django_logout
from django.db import IntegrityError
from django.http import HttpResponseRedirect
from ninja.errors import HttpError
from ninja_extra import api_controller, route
from ninja import Schema

from reptruly.users.emails import (
    get_preferences,
    send_verification_email,
    send_welcome_email,
)
from reptruly.users.verification import verify_token

User = get_user_model()


class LoginIn(Schema):
    username: str
    password: str


class SignupIn(Schema):
    username: str
    email: str
    password: str
    name: str | None = None


class UserOut(Schema):
    id: str
    username: str
    name: str
    email: str
    company_name: str = ""
    phone: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    country: str = ""
    profile_completed: bool = False
    email_verified: bool = False


class ProfileUpdateIn(Schema):
    name: str | None = None
    company_name: str | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None


class NotificationSettingsOut(Schema):
    email_override: str = ""
    new_reviews: bool
    negative_alerts: bool
    daily_digest: bool
    weekly_summary: bool
    monthly_report: bool
    rate_changes: bool
    sync_failures: bool
    marketing: bool


class NotificationSettingsIn(Schema):
    email_override: str | None = None
    new_reviews: bool | None = None
    negative_alerts: bool | None = None
    daily_digest: bool | None = None
    weekly_summary: bool | None = None
    monthly_report: bool | None = None
    rate_changes: bool | None = None
    sync_failures: bool | None = None
    marketing: bool | None = None


# Frontend field name -> Preferences model field name.
_NOTIFICATION_FIELDS = {
    "email_override": "alert_email",
    "new_reviews": "notify_new_reviews",
    "negative_alerts": "notify_negative_reviews",
    "daily_digest": "notify_daily_digest",
    "weekly_summary": "notify_weekly_summary",
    "monthly_report": "notify_monthly_report",
    "rate_changes": "notify_rate_changes",
    "sync_failures": "notify_sync_failures",
    "marketing": "receive_product_update_emails",
}


def _notifications_out(prefs) -> dict:
    return {api: getattr(prefs, model) for api, model in _NOTIFICATION_FIELDS.items()}


def _user_out(user) -> dict:
    return {
        "id": str(user.id),
        "username": user.username,
        "name": user.name or "",
        "email": user.email,
        "company_name": user.company_name or "",
        "phone": user.phone or "",
        "address": user.address or "",
        "city": user.city or "",
        "state": getattr(user, "state", "") or "",
        "country": user.country or "",
        "profile_completed": user.profile_completed,
        "email_verified": user.email_verified,
    }


@api_controller("/auth", tags=["auth"])
class AuthAPI:
    @route.post("/login", auth=None, response=UserOut)
    def login(self, request, data: LoginIn):
        user = authenticate(request, username=data.username, password=data.password)
        if not user:
            raise HttpError(401, "Invalid username or password")
        django_login(request, user)
        return _user_out(user)

    @route.post("/signup", auth=None, response=UserOut)
    def signup(self, request, data: SignupIn):
        username = data.username.strip()
        email = data.email.strip().lower()
        if not username or not data.password:
            raise HttpError(400, "Username and password are required")
        if len(data.password) < 8:
            raise HttpError(400, "Password must be at least 8 characters")
        if User.objects.filter(username__iexact=username).exists():
            raise HttpError(409, "Username already taken")
        if email and User.objects.filter(email__iexact=email).exists():
            raise HttpError(409, "Email already registered")
        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=data.password,
            )
        except IntegrityError:
            raise HttpError(409, "Account already exists")
        if data.name:
            user.name = data.name.strip()
            user.save(update_fields=["name"])
        # Materialize notification defaults so scheduled digests apply
        # even if the user never opens Settings.
        get_preferences(user)
        send_welcome_email(user, origin=f"{request.scheme}://{request.get_host()}")
        django_login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        return _user_out(user)

    @route.post("/logout", auth=None, response={200: dict})
    def logout(self, request):
        django_logout(request)
        return 200, {"message": "Logged out"}

    @route.get("/me", auth=None, response=UserOut)
    def me(self, request):
        if not request.user.is_authenticated:
            raise HttpError(401, "Not authenticated")
        return _user_out(request.user)

    @route.patch("/profile", auth=None, response=UserOut)
    def update_profile(self, request, data: ProfileUpdateIn):
        if not request.user.is_authenticated:
            raise HttpError(401, "Not authenticated")
        user = request.user
        updates: list[str] = []
        for field in ("name", "company_name", "phone", "address", "city", "state", "country"):
            value = getattr(data, field)
            if value is not None:
                setattr(user, field, value.strip())
                updates.append(field)
        if updates:
            user.save(update_fields=updates + ["last_login"] if False else updates)
        return _user_out(user)

    @route.get("/verify-email", auth=None)
    def verify_email(self, request, token: str):
        """Confirm an email address from the link in the welcome email.

        Redirects into the app either way so the user never sees raw JSON.
        """
        user = verify_token(token)
        if user is None:
            return HttpResponseRedirect("/dashboard?verified=expired")
        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=["email_verified"])
        return HttpResponseRedirect("/dashboard?verified=1")

    @route.post("/resend-verification", auth=None, response={200: dict})
    def resend_verification(self, request):
        """Send a fresh confirmation link to the logged-in user."""
        if not request.user.is_authenticated:
            raise HttpError(401, "Not authenticated")
        user = request.user
        if user.email_verified:
            return 200, {"message": "Email already verified"}
        send_verification_email(
            user, origin=f"{request.scheme}://{request.get_host()}"
        )
        return 200, {"message": "Verification email sent"}

    @route.get("/notifications", auth=None, response=NotificationSettingsOut)
    def get_notifications(self, request):
        """The user's email notification preferences."""
        if not request.user.is_authenticated:
            raise HttpError(401, "Not authenticated")
        return _notifications_out(get_preferences(request.user))

    @route.put("/notifications", auth=None, response=NotificationSettingsOut)
    def update_notifications(self, request, data: NotificationSettingsIn):
        """Update email notification preferences (partial updates allowed)."""
        if not request.user.is_authenticated:
            raise HttpError(401, "Not authenticated")
        prefs = get_preferences(request.user)
        updates: list[str] = []
        for api_field, model_field in _NOTIFICATION_FIELDS.items():
            value = getattr(data, api_field)
            if value is not None:
                setattr(prefs, model_field, value.strip() if isinstance(value, str) else value)
                updates.append(model_field)
        if updates:
            prefs.save(update_fields=updates)
        return _notifications_out(prefs)
