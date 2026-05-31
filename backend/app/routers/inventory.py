from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.models.schemas import InventoryItemCreate, InventoryItemOut, TransactionOut
from app.services.base_unit_math import to_display

router = APIRouter()


@router.get("/", response_model=list[InventoryItemOut])
def list_items(upc: str | None = None, db=Depends(get_db)):
    q = db.table("inventory_items").select("*")
    if upc:
        q = q.eq("upc", upc)
    else:
        q = q.order("name")
    result = q.execute()
    return result.data


@router.post("/", response_model=InventoryItemOut, status_code=201)
def create_item(item: InventoryItemCreate, db=Depends(get_db)):
    payload = {
        "name": item.name,
        "category": item.category.value,
        "container_type": item.container_type.value,
        "units_per_pack": item.units_per_pack,
        "units_per_case": item.units_per_case,
        "current_units": item.initial_units,
        "tags": item.tags,
        "reorder_cases": item.reorder_cases,
    }
    if item.sku:
        payload["sku"] = item.sku
    if item.location_id:
        payload["location_id"] = str(item.location_id)
    if item.photo_url:
        payload["photo_url"] = item.photo_url
    if item.upc:
        payload["upc"] = item.upc
    if item.min_stock_units is not None:
        payload["min_stock_units"] = item.min_stock_units

    result = db.table("inventory_items").insert(payload).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create item")
    return result.data[0]


@router.get("/{item_id}", response_model=InventoryItemOut)
def get_item(item_id: UUID, db=Depends(get_db)):
    result = (
        db.table("inventory_items").select("*").eq("id", str(item_id)).single().execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Item not found")
    return result.data


@router.get("/{item_id}/history", response_model=list[TransactionOut])
def item_history(item_id: UUID, limit: int = 50, db=Depends(get_db)):
    result = (
        db.table("inventory_transactions")
        .select("*")
        .eq("item_id", str(item_id))
        .order("server_received_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data


@router.get("/{item_id}/display-stock")
def display_stock(item_id: UUID, db=Depends(get_db)):
    result = (
        db.table("inventory_items").select("*").eq("id", str(item_id)).single().execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Item not found")
    item = result.data
    breakdown = to_display(item["current_units"], item["units_per_case"], item["units_per_pack"])
    return {"item_id": item_id, "current_units": item["current_units"], "display": breakdown}
