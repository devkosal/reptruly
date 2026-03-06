import stripe
from allauth.account.models import EmailAddress
from django.conf import settings
from django.contrib import messages
from django.contrib.auth import get_user_model
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import HttpResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views import View
from djstripe.models import Customer, Price

from reptruly.billing.utils import set_stripe_api_key
from reptruly.core.common.constants import LOCALHOST_URLS
from reptruly.core.common.exceptions import (
    AlreadySubscribedException,
    HTTPNotAllowedException,
)
from reptruly.core.common.utils import get_domain_from_request, get_domain_from_url

set_stripe_api_key()
User = get_user_model()


# Create your views here.
class StripeCustomerPortalView(LoginRequiredMixin, View):
    def create_stripe_customer(self, user: User, email: str) -> User:
        customer = stripe.Customer.create(
            email=email,
        )
        djstripe_customer = Customer.sync_from_stripe_data(customer)
        user.customer = djstripe_customer
        user.save()
        return user

    def get(self, request):
        user = request.user

        if user.customer is None or user.customer.deleted:
            primary_email = EmailAddress.objects.get_primary(user)
            if not primary_email:
                messages.error(
                    request,
                    "must have a verified primary email address to access billing.",
                )
                return self.get(request)
            user = self.create_stripe_customer(user, primary_email.email)
        current_domain = get_domain_from_request(request)
        scheme = request.scheme
        # important:so we must use an ngrok domain for local testing
        if current_domain.startswith(tuple(LOCALHOST_URLS)):
            current_domain = get_domain_from_url(settings.DOMAIN_NAME)
            scheme = "https"
        # if scheme == "http":
        #     raise HTTPNotAllowedException("stripe requires the return url domain to be https")
        return_url = f'{scheme}://{current_domain}{reverse("account_email")}'
        session = stripe.billing_portal.Session.create(
            customer=user.customer.id,
            # account_email is the default settings page
            return_url=return_url,
        )
        # TODO(devkosal): make sure this uses https
        return redirect(session.url)


stripe_customer_portal_view = StripeCustomerPortalView.as_view()
