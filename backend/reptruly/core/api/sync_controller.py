from datetime import datetime

from ninja import Schema
from ninja.errors import HttpError
from ninja_extra import api_controller, route

from reptruly.core.models import SyncStatus
from reptruly.core.sync_tasks import DOMAIN_TO_TASK


VALID_DOMAINS = {d.value for d in SyncStatus.Domain}


class SyncStatusOut(Schema):
    domain: str
    status: str
    last_synced_at: datetime | None = None
    last_started_at: datetime | None = None
    last_duration_ms: int | None = None
    last_record_count: int = 0
    last_error: str = ""


class SyncTriggerOut(Schema):
    domain: str
    queued: bool
    task_id: str | None = None


def _serialize(s: SyncStatus) -> dict:
    return {
        "domain": s.domain,
        "status": s.status,
        "last_synced_at": s.last_synced_at,
        "last_started_at": s.last_started_at,
        "last_duration_ms": s.last_duration_ms,
        "last_record_count": s.last_record_count,
        "last_error": s.last_error or "",
    }


def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        raise HttpError(401, "Not authenticated")


@api_controller("/sync", tags=["sync"])
class SyncAPI:
    @route.get("/status", auth=None, response=list[SyncStatusOut])
    def status(self, request):
        """Return last-sync info for every domain. Missing rows are reported as idle."""
        _ensure_authenticated(request)
        existing = {s.domain: s for s in SyncStatus.objects.all()}
        out: list[dict] = []
        for domain in SyncStatus.Domain.values:
            row = existing.get(domain)
            if row is None:
                out.append({
                    "domain": domain,
                    "status": SyncStatus.Status.IDLE,
                    "last_synced_at": None,
                    "last_started_at": None,
                    "last_duration_ms": None,
                    "last_record_count": 0,
                    "last_error": "",
                })
            else:
                out.append(_serialize(row))
        return out

    @route.get("/status/{domain}", auth=None, response=SyncStatusOut)
    def status_one(self, request, domain: str):
        _ensure_authenticated(request)
        if domain not in VALID_DOMAINS:
            raise HttpError(404, f"Unknown sync domain: {domain}")
        row, _ = SyncStatus.objects.get_or_create(domain=domain)
        return _serialize(row)

    @route.post("/{domain}/run", auth=None, response=SyncTriggerOut)
    def trigger(self, request, domain: str):
        """Queue a force-sync for the given domain."""
        _ensure_authenticated(request)
        if domain not in VALID_DOMAINS:
            raise HttpError(404, f"Unknown sync domain: {domain}")
        task = DOMAIN_TO_TASK.get(domain)
        if task is None:
            # Calendar/analytics compute on demand (24h caches) — nothing to sync.
            raise HttpError(
                400,
                f"The {domain} data refreshes on demand — use the refresh "
                "controls on its page instead.",
            )
        async_result = task.delay()
        return {"domain": domain, "queued": True, "task_id": str(async_result.id)}
