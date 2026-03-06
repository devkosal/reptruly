# from django.contrib.auth import get_user_model
from ninja import ModelSchema
from ninja_apikey.models import APIKey


class APIKeySchema(ModelSchema):
    class Meta:
        model = APIKey
        fields = ["hashed_key"]
