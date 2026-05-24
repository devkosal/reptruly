from django.contrib.auth import authenticate, get_user_model, login as django_login, logout as django_logout
from django.db import IntegrityError
from ninja.errors import HttpError
from ninja_extra import api_controller, route
from ninja import Schema

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


class ProfileUpdateIn(Schema):
    name: str | None = None
    company_name: str | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None


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
