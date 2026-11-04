"""
QRGenerator — FastAPI Backend
Run: uvicorn backend.main:app --reload --port 8001
"""
import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .core.config import settings
from .routers import auth_router, qr_router

app = FastAPI(
    title="QRGenerator API",
    description="QR code generator with custom styles — like qrfy.com",
    version=settings.app_version,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
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
