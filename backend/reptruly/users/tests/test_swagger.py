import pytest
from django.urls import reverse


def test_swagger_accessible_by_admin(admin_client):
    url = reverse("api-1.0.0:openapi-view")
    response = admin_client.get(url)
    assert response.status_code == 200


@pytest.mark.django_db
def test_swagger_ui_not_accessible_by_normal_user(client):
    url = reverse("api-1.0.0:openapi-view")
    response = client.get(url)
    # django ninja returns a 302, not 403 like drf
    assert response.status_code == 302


def test_api_schema_generated_successfully(admin_client):
    url = reverse("api-1.0.0:openapi-json")
    response = admin_client.get(url)
    assert response.status_code == 200
