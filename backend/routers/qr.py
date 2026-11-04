"""
QR Code Router
POST /api/qr/generate   — generate a QR code (with/without auth)
POST /api/qr/           — save QR to account (requires auth)
GET  /api/qr/           — list user's QR codes
GET  /api/qr/:id        — get a specific QR code
PUT  /api/qr/:id        — update QR code
DELETE /api/qr/:id      — delete QR code
GET  /api/qr/:id/image  — download PNG
GET  /api/qr/:id/svg    — download SVG
"""
import uuid
import aiofiles
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from ..models.qr import QRCreate, QRCode, QRType, QRStyle
from ..services.qr_service import generate_qr_image, generate_qr_svg
from ..core.database import get_db
from ..core.security import get_current_user, get_optional_user
from ..core.config import settings

router = APIRouter(prefix="/api/qr", tags=["qr"])


@router.post("/generate")
async def generate_preview(
    data: QRCreate,
    current_user=Depends(get_optional_user)
):
    """
    Generate a QR code image without saving.
    Works for logged-out users too (no auth required).
    Returns base64 PNG for instant display.
    """
    _, b64 = generate_qr_image(data)
    return {
        "image_b64":    b64,
        "content_type": "image/png",
        "format":       "base64",
    }


@router.post("/", response_model=QRCode)
async def create_qr(
    data: QRCreate,
    current_user=Depends(get_current_user)
):
    """Create and save a QR code to the user's account."""
    png_bytes, b64 = generate_qr_image(data)

    qr_id   = str(uuid.uuid4())
    user_id = current_user["_id"]

    # Save PNG to disk
    img_dir = settings.qr_output_dir / user_id
    img_dir.mkdir(parents=True, exist_ok=True)
    img_path = img_dir / f"{qr_id}.png"
    async with aiofiles.open(img_path, "wb") as f:
        await f.write(png_bytes)

    doc = {
        "_id":        qr_id,
        "user_id":    user_id,
        "title":      data.title,
        "qr_type":    data.qr_type,
        "content":    data.content,
        "style":      data.style.model_dump(),
        "image_path": str(img_path),
        "image_b64":  b64,
        "scans":      0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    db = get_db()
    await db.qrcodes.insert_one(doc)
    await db.users.update_one(
        {"_id": user_id},
        {"$inc": {"qr_count": 1}}
    )

    return _doc_to_qr(doc)


@router.get("/", response_model=list[QRCode])
async def list_qr(
    limit: int = 50,
    current_user=Depends(get_current_user)
):
    """List all QR codes for the authenticated user."""
    db = get_db()
    cursor = db.qrcodes.find(
        {"user_id": current_user["_id"]}
    ).sort("created_at", -1).limit(limit)

    qrs = []
    async for doc in cursor:
        qrs.append(_doc_to_qr(doc))
    return qrs


@router.get("/{qr_id}", response_model=QRCode)
async def get_qr(
    qr_id: str,
    current_user=Depends(get_current_user)
):
    db = get_db()
    doc = await db.qrcodes.find_one({
        "_id": qr_id,
        "user_id": current_user["_id"]
    })
    if not doc:
        raise HTTPException(404, "QR code not found")
    return _doc_to_qr(doc)


@router.put("/{qr_id}", response_model=QRCode)
async def update_qr(
    qr_id: str,
    data: QRCreate,
    current_user=Depends(get_current_user)
):
    """Regenerate a QR code with new content/style."""
    db = get_db()
    doc = await db.qrcodes.find_one({
        "_id": qr_id,
        "user_id": current_user["_id"]
    })
    if not doc:
        raise HTTPException(404, "QR code not found")

    png_bytes, b64 = generate_qr_image(data)

    # Overwrite the old image file
    if doc.get("image_path"):
        try:
            async with aiofiles.open(doc["image_path"], "wb") as f:
                await f.write(png_bytes)
        except Exception:
            pass

    updates = {
        "title":      data.title,
        "qr_type":    data.qr_type,
        "content":    data.content,
        "style":      data.style.model_dump(),
        "image_b64":  b64,
        "updated_at": datetime.utcnow(),
    }
    await db.qrcodes.update_one({"_id": qr_id}, {"$set": updates})
    doc.update(updates)
    return _doc_to_qr(doc)


@router.delete("/{qr_id}")
async def delete_qr(
    qr_id: str,
    current_user=Depends(get_current_user)
):
    db = get_db()
    doc = await db.qrcodes.find_one({
        "_id": qr_id,
        "user_id": current_user["_id"]
    })
    if not doc:
        raise HTTPException(404, "QR code not found")

    # Delete image file
    if doc.get("image_path"):
        try:
            Path(doc["image_path"]).unlink(missing_ok=True)
        except Exception:
            pass

    await db.qrcodes.delete_one({"_id": qr_id})
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$inc": {"qr_count": -1}}
    )
    return {"deleted": True, "id": qr_id}


@router.get("/{qr_id}/image")
async def download_image(
    qr_id: str,
    current_user=Depends(get_current_user)
):
    """Download QR code as PNG."""
    db = get_db()
    doc = await db.qrcodes.find_one({
        "_id": qr_id,
        "user_id": current_user["_id"]
    })
    if not doc:
        raise HTTPException(404, "QR code not found")

    if doc.get("image_path") and Path(doc["image_path"]).exists():
        async with aiofiles.open(doc["image_path"], "rb") as f:
            data = await f.read()
        return Response(
            content=data,
            media_type="image/png",
            headers={"Content-Disposition": f'attachment; filename="{doc["title"]}.png"'}
        )
    elif doc.get("image_b64"):
        import base64
        data = base64.b64decode(doc["image_b64"])
        return Response(
            content=data,
            media_type="image/png",
            headers={"Content-Disposition": f'attachment; filename="{doc["title"]}.png"'}
        )
    raise HTTPException(404, "Image file not found")


@router.get("/{qr_id}/svg")
async def download_svg(
    qr_id: str,
    current_user=Depends(get_current_user)
):
    """Download QR code as SVG (scalable vector, perfect for print)."""
    db = get_db()
    doc = await db.qrcodes.find_one({
        "_id": qr_id,
        "user_id": current_user["_id"]
    })
    if not doc:
        raise HTTPException(404, "QR code not found")

    qr_create = QRCreate(
        title=doc["title"],
        qr_type=doc["qr_type"],
        content=doc["content"],
        style=QRStyle(**doc.get("style", {}))
    )
    svg_content = generate_qr_svg(qr_create)
    return Response(
        content=svg_content,
        media_type="image/svg+xml",
        headers={"Content-Disposition": f'attachment; filename="{doc["title"]}.svg"'}
    )


def _doc_to_qr(doc: dict) -> QRCode:
    """Convert MongoDB document to QRCode model."""
    return QRCode(
        id=doc["_id"],
        user_id=doc.get("user_id"),
        title=doc["title"],
        qr_type=doc["qr_type"],
        content=doc["content"],
        style=QRStyle(**doc.get("style", {})),
        image_path=doc.get("image_path"),
        image_b64=doc.get("image_b64"),
        scans=doc.get("scans", 0),
        created_at=doc.get("created_at", datetime.utcnow()),
        updated_at=doc.get("updated_at", datetime.utcnow()),
    )
