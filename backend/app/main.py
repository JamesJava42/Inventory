from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import inventory, sync, missing

app = FastAPI(
    title="Liquor Store Inventory API",
    version="1.0.0",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
app.include_router(sync.router, prefix="/sync", tags=["sync"])
app.include_router(missing.router, prefix="/missing-items", tags=["missing-items"])


@app.get("/health")
def health():
    return {"status": "ok"}
