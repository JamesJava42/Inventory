from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.database import get_db
from app.models.schemas import (
    InventoryItemOut,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
)
from app.services.sync_engine import push_transactions

router = APIRouter()


@router.post("/push", response_model=SyncPushResponse)
def sync_push(payload: SyncPushRequest, db=Depends(get_db)):
    results = push_transactions(payload.transactions, db)

    processed = sum(1 for r in results if r.status == "ok")
    skipped = sum(1 for r in results if r.status == "skipped")
    failed = sum(1 for r in results if r.status == "failed")

    return SyncPushResponse(
        results=results,
        processed=processed,
        skipped=skipped,
        failed=failed,
    )


@router.get("/pull", response_model=SyncPullResponse)
def sync_pull(since: str | None = None, db=Depends(get_db)):
    """
    Return all inventory items updated after `since` (ISO-8601 timestamp).
    Mobile calls this on reconnect to get any server-side changes it missed.
    """
    query = db.table("inventory_items").select("*")
    if since:
        query = query.gte("updated_at", since)
    result = query.execute()

    return SyncPullResponse(
        items=result.data,
        last_synced_at=datetime.now(timezone.utc),
    )
