from django.contrib import messages
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import PBKDF2PasswordHasher, make_password
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.messages.views import SuccessMessageMixin
from django.http import HttpResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils.crypto import get_random_string
from django.utils.translation import gettext_lazy as _
from django.views.generic import DetailView, RedirectView, UpdateView
from django.views.generic.base import View
from ninja_apikey.models import APIKey
from ninja_apikey.security import KeyData

from reptruly.users.forms import UserAPIKeyForm

User = get_user_model()
API_KEY_HASHER = PBKDF2PasswordHasher()


class UserDetailView(LoginRequiredMixin, DetailView):
    model = User
    slug_field = "username"
    slug_url_kwarg = "username"


user_detail_view = UserDetailView.as_view()


class UserUpdateView(LoginRequiredMixin, SuccessMessageMixin, UpdateView):
    model = User
    fields = ["name"]
    success_message = _("Information successfully updated")

    def get_success_url(self):
        assert (
            self.request.user.is_authenticated
        )  # for mypy to know that the user is authenticated
        return self.request.user.get_absolute_url()

    def get_object(self):
        return self.request.user


user_update_view = UserUpdateView.as_view()


class UserRedirectView(LoginRequiredMixin, RedirectView):
    permanent = False

    def get_redirect_url(self):
        return reverse("users:detail", kwargs={"username": self.request.user.username})


user_redirect_view = UserRedirectView.as_view()


class UserAPIKeyView(LoginRequiredMixin, View):
    _template_name = "users/user_apikey.html"

    @staticmethod
    def generate_key() -> KeyData:
        prefix = get_random_string(8)
        key = get_random_string(56)
        hashed_key = make_password(key, hasher=API_KEY_HASHER)
        return KeyData(prefix, key, hashed_key)

    def get(self, request, *args, **kwargs):
        form = UserAPIKeyForm()
        return render(request, self._template_name, context={"form": form})

    def post(self, request, *args, **kwargs):
        form = UserAPIKeyForm()
        user = request.user
        existing_api_keys = APIKey.objects.filter(user=user, revoked=False)
        if existing_api_keys.exists():
            if len(existing_api_keys) > 1:
                # Bad API Key Configuration
                res = HttpResponse("Server Error", status_code=500)
                return res
            existing_api_key = existing_api_keys.first()
            existing_api_key.revoked = True
            existing_api_key.save(update_fields=["revoked"])
        key_data = self.generate_key()
        key = APIKey(prefix=key_data.prefix, hashed_key=key_data.hashed_key, user=user)
        key.save()
        api_key = key_data.prefix + "." + key_data.key
        messages.success(
            request,
            message="API key is generated. "
            "You should store it somewhere safe. "
            "You will not be able to see the key again.",
        )
        return render(
            request, self._template_name, context={"form": form, "api_key": api_key}
        )


generate_api_key_view = UserAPIKeyView.as_view()
