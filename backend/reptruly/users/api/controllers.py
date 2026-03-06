#  USERAPI is disabled 07.27.2023

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import PBKDF2PasswordHasher, make_password
from django.utils.crypto import get_random_string
from ninja.responses import codes_4xx
from ninja_apikey.models import APIKey
from ninja_apikey.security import APIKeyAuth, KeyData
from ninja_extra import api_controller, http_get, http_post

from reptruly.core.common.schema import Message
from reptruly.users.api.schema import APIKeySchema

auth = APIKeyAuth()
User = get_user_model()
# we use PBKDF2PasswordHasher so the hashed key < 100 required max chr length in api key model
API_KEY_HASHER = PBKDF2PasswordHasher()


@api_controller(auth=auth)
class UserAPI:
    @staticmethod
    def get_user_from_user_and_pass(
        username: str, password: str
    ) -> tuple[int, User | Message]:
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return 404, {"message": "user does not exist"}
        if not user.check_password(password):
            return 401, {"message": "invalid password"}
        return user

    @staticmethod
    def generate_key() -> KeyData:
        prefix = get_random_string(8)
        key = get_random_string(56)
        hashed_key = make_password(key, hasher=API_KEY_HASHER)
        return KeyData(prefix, key, hashed_key)

    @http_post("/create-api-key", auth=None, response={200: str, codes_4xx: Message})
    def create_api_key(
        self,
        username: str,
        password: str,
        should_refresh: bool = False,
        *args,
        **kwargs
    ) -> tuple[int, str]:
        user = self.get_user_from_user_and_pass(username, password)
        existing_api_keys = APIKey.objects.filter(user=user)
        if existing_api_keys.exists():
            if not should_refresh:
                return 409, {"message": "API key resource already exists"}
            else:
                if len(existing_api_keys) > 1:
                    return 500, {"message": "Bad API Key Configuration"}
                existing_api_key = existing_api_keys[0]
                existing_api_key.revoked = True
                existing_api_key.save(update_fields=["revoked"])
        key_data = self.generate_key()
        key = APIKey(prefix=key_data.prefix, hashed_key=key_data.hashed_key, user=user)
        key.save()
        return 200, key_data.prefix + "." + key_data.key

    @http_get("/api-key", auth=None, response={200: APIKeySchema, codes_4xx: Message})
    def api_key(self, username: str, password: str, *args, **kwargs):
        user = self.get_user_from_user_and_pass(username, password)
        keys = APIKey.objects.get(user=user)
        valid_keys = [k for k in keys.objects if k.is_valid()]
        if not valid_keys:
            return 404, {"message": "no valid api key found for user"}
        return 200, valid_keys[0]
