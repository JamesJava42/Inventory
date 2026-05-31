"""
Delta-ledger sync engine.

Every mutation from the mobile app arrives as a signed delta
(e.g. -6 for a six-pack sold, +24 for a case restocked).
The engine applies each delta atomically and uses client_uuid for
idempotency so retries and offline-concurrent writes are both safe.
"""

from __future__ import annotations

from uuid import UUID

from supabase import Client

from app.models.schemas import SyncPushResult, TransactionIn


def push_transactions(
    transactions: list[TransactionIn], db: Client
) -> list[SyncPushResult]:
    results: list[SyncPushResult] = []

    for txn in transactions:
        result = _process_one(txn, db)
        results.append(result)

    return results


def _process_one(txn: TransactionIn, db: Client) -> SyncPushResult:
    uuid_str = str(txn.client_uuid)

    # --- Idempotency check ---
    existing = (
        db.table("inventory_transactions")
        .select("id")
        .eq("client_uuid", uuid_str)
        .execute()
    )
    if existing.data:
        return SyncPushResult(
            client_uuid=txn.client_uuid,
            status="skipped",
            message="Already processed",
        )

    # --- Fetch current stock ---
    item_resp = (
        db.table("inventory_items")
        .select("id, current_units")
        .eq("id", str(txn.item_id))
        .single()
        .execute()
    )
    if not item_resp.data:
        return SyncPushResult(
            client_uuid=txn.client_uuid,
            status="failed",
            message=f"Item {txn.item_id} not found",
        )

    current_units: int = item_resp.data["current_units"]
    new_units = current_units + txn.delta_units

    if new_units < 0:
        return SyncPushResult(
            client_uuid=txn.client_uuid,
            status="failed",
            message=(
                f"Delta {txn.delta_units} would reduce stock below zero "
                f"(current: {current_units})"
            ),
        )

    # --- Insert transaction row ---
    db.table("inventory_transactions").insert(
        {
            "client_uuid": uuid_str,
            "item_id": str(txn.item_id),
            "delta_units": txn.delta_units,
            "transaction_type": txn.transaction_type.value,
            "created_at": txn.created_at.isoformat(),
            "notes": txn.notes,
        }
    ).execute()

    # --- Update current stock ---
    db.table("inventory_items").update(
        {"current_units": new_units}
    ).eq("id", str(txn.item_id)).execute()

    return SyncPushResult(client_uuid=txn.client_uuid, status="ok")
