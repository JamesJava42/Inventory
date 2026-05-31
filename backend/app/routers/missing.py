from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import get_db
from app.models.schemas import TransactionIn, TransactionType
from app.services.sync_engine import push_transactions

router = APIRouter()


class MissingItemCreate(BaseModel):
    item_id: str
    cases_needed: int = 1


class MissingItemOut(BaseModel):
    id: str
    item_id: str
    cases_needed: int
    cases_picked: int
    status: str
    picked_at: str | None
    created_at: str
    product_name: str
    product_photo: str | None
    product_tags: list[str]
    units_per_case: int
    reorder_cases: int


@router.post("/", status_code=201)
def add_missing_item(body: MissingItemCreate, db=Depends(get_db)):
    # Upsert: if already on active list, just update quantity
    existing = (
        db.table("missing_items")
        .select("id")
        .eq("item_id", body.item_id)
        .in_("status", ["missing", "picked"])
        .execute()
    )
    if existing.data:
        row_id = existing.data[0]["id"]
        db.table("missing_items").update({"cases_needed": body.cases_needed}).eq("id", row_id).execute()
        return {"status": "updated", "id": row_id}

    result = db.table("missing_items").insert({
        "item_id": body.item_id,
        "cases_needed": body.cases_needed,
        "status": "missing",
    }).execute()
    return {"status": "created", "id": result.data[0]["id"]}


@router.get("/", response_model=list[MissingItemOut])
def list_missing_items(db=Depends(get_db)):
    rows = (
        db.table("missing_items")
        .select("*, inventory_items(name, photo_url, tags, units_per_case, reorder_cases)")
        .in_("status", ["missing", "picked"])
        .order("created_at", desc=False)
        .execute()
    ).data or []

    out = []
    for row in rows:
        p = row.get("inventory_items") or {}
        out.append({
            "id": row["id"],
            "item_id": row["item_id"],
            "cases_needed": row["cases_needed"],
            "cases_picked": row.get("cases_picked", 0),
            "status": row["status"],
            "picked_at": row.get("picked_at"),
            "created_at": row["created_at"],
            "product_name": p.get("name", "Unknown"),
            "product_photo": p.get("photo_url"),
            "product_tags": p.get("tags") or [],
            "units_per_case": p.get("units_per_case", 24),
            "reorder_cases": p.get("reorder_cases", 2),
        })
    return out


@router.get("/count")
def missing_count(db=Depends(get_db)):
    result = (
        db.table("missing_items")
        .select("id", count="exact")
        .eq("status", "missing")
        .execute()
    )
    return {"count": result.count or 0}


@router.post("/{item_id}/pick")
def pick_item(item_id: str, db=Depends(get_db)):
    db.table("missing_items").update({
        "status": "picked",
        "picked_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", item_id).execute()
    return {"status": "picked"}


@router.post("/{item_id}/unpick")
def unpick_item(item_id: str, db=Depends(get_db)):
    db.table("missing_items").update({
        "status": "missing",
        "picked_at": None,
    }).eq("id", item_id).execute()
    return {"status": "missing"}


@router.post("/{item_id}/restock")
def restock_item(item_id: str, db=Depends(get_db)):
    row_resp = (
        db.table("missing_items")
        .select("*, inventory_items(units_per_case, current_units)")
        .eq("id", item_id)
        .single()
        .execute()
    )
    if not row_resp.data:
        raise HTTPException(status_code=404, detail="Missing item not found")

    row = row_resp.data
    product = row.get("inventory_items") or {}
    units_per_case = product.get("units_per_case", 24)
    delta = row["cases_needed"] * units_per_case

    from uuid import UUID
    tx = TransactionIn(
        client_uuid=uuid4(),
        item_id=UUID(row["item_id"]),
        delta_units=delta,
        transaction_type=TransactionType.restock,
        created_at=datetime.now(timezone.utc),
        notes=f"Restocked from missing list: {row['cases_needed']} case(s)",
    )

    results = push_transactions([tx], db)
    if results[0].status == "failed":
        raise HTTPException(status_code=400, detail=results[0].message)

    db.table("missing_items").update({
        "status": "restocked",
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", item_id).execute()

    return {
        "status": "restocked",
        "delta_units": delta,
    }


@router.delete("/{item_id}")
def remove_missing_item(item_id: str, db=Depends(get_db)):
    db.table("missing_items").delete().eq("id", item_id).execute()
    return {"status": "deleted"}
