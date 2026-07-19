"""API-key lifecycle helpers for the public read API.

Built on `ninja_apikey`: a key is stored as (prefix, hashed_key) and presented
by clients as the header `X-API-Key: <prefix>.<key>`. The plaintext key exists
only at creation time — we return it exactly once and never persist it.
"""

from ninja_apikey.models import APIKey
from ninja_apikey.security import generate_key

from reptruly.users.models import APIKeyProfile

# ninja_apikey.models.APIKey.label is max_length=40
MAX_LABEL_LENGTH = 40


def create_api_key(user, label: str) -> str:
    """Create a new API key for `user` and return the full plaintext key.

    The returned string ("<prefix>.<key>") is shown to the caller exactly once;
    only the salted hash is stored.
    """
    label = (label or "").strip()[:MAX_LABEL_LENGTH]
    key_data = generate_key()  # KeyData(prefix, key, hashed_key)
    api_key = APIKey.objects.create(
        prefix=key_data.prefix,
        hashed_key=key_data.hashed_key,
        user=user,
        label=label,
    )
    # Keep the app-side profile in sync so admin tooling can attach metadata.
    APIKeyProfile.objects.create(api_key=api_key, name=label)
    return f"{key_data.prefix}.{key_data.key}"


def revoke_api_key(user, prefix: str) -> bool:
    """Revoke the key with `prefix` if it belongs to `user`.

    Returns True if a key was revoked, False if no matching active key exists.
    Revocation is a soft delete: the row stays for audit, the key stops working.
    """
    updated = APIKey.objects.filter(user=user, prefix=prefix, revoked=False).update(
        revoked=True
    )
    return bool(updated)


def list_api_keys(user) -> list[dict]:
    """List all of `user`'s keys (including revoked ones) — never the secret."""
    return [
        {
            "prefix": k.prefix,
            "label": k.label,
            "created_at": k.created_at,
            "expires_at": k.expires_at,
            "revoked": k.revoked,
        }
        for k in APIKey.objects.filter(user=user)
    ]
