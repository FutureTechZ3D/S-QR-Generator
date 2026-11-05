"""
QRGenerator — FastAPI Backend
Run: uvicorn backend.main:app --reload --port 8001
"""
import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .core.config import settings
from .core.database import get_db, ensure_indexes
from .routers import auth_router, qr_router, social_router, dynamic_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks (indexes) before serving, cleanup on shutdown."""
    await ensure_indexes()
    yield


app = FastAPI(
    title="QRGenerator API",
    description="QR code generator with custom styles — like qrfy.com",
    version=settings.app_version,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(qr_router)
app.include_router(social_router)
app.include_router(dynamic_router)

# Serve QR output images
qr_dir = settings.qr_output_dir
if qr_dir.exists():
    app.mount("/qr-images", StaticFiles(directory=str(qr_dir)), name="qr-images")


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "version": settings.app_version,
        "service": "QRGenerator",
    }


@app.get("/")
async def root():
    return {"name": "QRGenerator API", "docs": "/api/docs"}
