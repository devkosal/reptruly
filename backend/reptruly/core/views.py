from django.http import Http404, JsonResponse
from django.views.defaults import ERROR_404_TEMPLATE_NAME
from django.views.defaults import page_not_found as base_page_not_found


def health_check(request):
    """Health check endpoint for load balancers."""
    return JsonResponse({"status": "ok"})


def page_not_found(
    request,
    exception: Exception = Http404(),
    template_name=ERROR_404_TEMPLATE_NAME,
    *args,
    **kwargs,
):
    return base_page_not_found(request, exception, template_name)
