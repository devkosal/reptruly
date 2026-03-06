from django.http import Http404
from django.urls import reverse


def admin_restriction_middleware(get_response):
    """
    A middleware that restricts staff members access to administration panels.
    doc: https://docs.djangoproject.com/en/4.2/topics/http/middleware/
    """

    def middleware(request):
        response = get_response(request)
        if request.path.startswith(reverse("admin:index")):
            # only admin should have access to the admin panel
            if not request.user.is_authenticated or request.user.username != "admin":
                raise Http404
        return response

    return middleware
