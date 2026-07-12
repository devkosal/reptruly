"""Signed email-verification tokens — no extra model, just django signing."""
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner

from reptruly.users.models import User

# Links stay valid for 3 days; resend is available from the app after that.
MAX_AGE_SECONDS = 3 * 24 * 3600

_signer = TimestampSigner(salt="reptruly.email-verification")


def make_token(user: User) -> str:
    return _signer.sign(str(user.id))


def verify_token(token: str) -> User | None:
    try:
        user_id = _signer.unsign(token, max_age=MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None
    return User.objects.filter(id=user_id).first()
