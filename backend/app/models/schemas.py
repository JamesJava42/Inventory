from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class ContainerType(str, Enum):
    single = "single"
    six_pack = "six_pack"
    twelve_pack = "twelve_pack"
    flat_18 = "flat_18"
    case_24 = "case_24"
    case_30 = "case_30"
    case_12 = "case_12"
    case_6 = "case_6"


class Category(str, Enum):
    beer = "beer"
    wine = "wine"
    spirits = "spirits"
    non_alcoholic = "non_alcoholic"


class TransactionType(str, Enum):
    sale = "sale"
    restock = "restock"
    transfer = "transfer"
    adjustment = "adjustment"
    count = "count"


class InventoryItemCreate(BaseModel):
    name: str
    sku: str | None = None
    category: Category
    container_type: ContainerType
    units_per_pack: int = 6
    units_per_case: int = 24
    initial_units: int = 0
    location_id: UUID | None = None
    photo_url: str | None = None
    tags: list[str] = []
    upc: str | None = None
    reorder_cases: int = 2
    min_stock_units: int | None = None


class TransactionOut(BaseModel):
    id: UUID
    client_uuid: UUID
    item_id: UUID
    delta_units: int
    transaction_type: TransactionType
    notes: str | None
    created_at: datetime
    server_received_at: datetime


class InventoryItemOut(BaseModel):
    id: UUID
    name: str
    sku: str | None
    category: Category
    container_type: ContainerType
    units_per_pack: int
    units_per_case: int
    current_units: int
    location_id: UUID | None
    created_at: datetime
    updated_at: datetime
    photo_url: str | None = None
    tags: list[str] = []
    upc: str | None = None
    reorder_cases: int = 2
    min_stock_units: int | None = None


class TransactionIn(BaseModel):
    client_uuid: UUID
    item_id: UUID
    delta_units: int
    transaction_type: TransactionType
    created_at: datetime
    notes: str | None = None


class SyncPushRequest(BaseModel):
    transactions: list[TransactionIn]


class SyncPushResult(BaseModel):
    client_uuid: UUID
    status: str
    message: str | None = None


class SyncPushResponse(BaseModel):
    results: list[SyncPushResult]
    processed: int
    skipped: int
    failed: int


class SyncPullResponse(BaseModel):
    items: list[InventoryItemOut]
    last_synced_at: datetime
