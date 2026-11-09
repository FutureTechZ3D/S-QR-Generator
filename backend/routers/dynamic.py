# backend/routers/dynamic.py
"""
Dynamic QR routes.

POST   /api/dynamic              → create dynamic QR (auth required)
GET    /api/dynamic              → list user's dynamic QRs (auth required)
PUT    /api/dynamic/{dqr_id}     → update destination URL (auth required, must own)
DELETE /api/dynamic/{dqr_id}     → delete (auth required, must own)
GET    /api/dynamic/{id}/analytics → scan analytics (auth required, must own)
GET    /r/{dqr_id}               → PUBLIC redirect (no auth, logs scan)
"""
import uuid
import aiofiles
import hashlib
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, HTMLResponse
from ..models.dynamic import DynamicQR, DynamicQRCreate, DynamicQRUpdate
from ..models.qr import QRCreate, QRType, QRStyle
from ..services.qr_service import generate_qr_image
from ..core.database import get_db
from ..core.security import get_current_user, hash_password, verify_password
from ..core.config import settings

router = APIRouter(tags=["dynamic"])


# ── Helper ────────────────────────────────────────────────────────────────────

def _doc_to_dynamic(doc: dict) -> DynamicQR:
    return DynamicQR(
        id=doc["_id"],
        user_id=doc["user_id"],
        title=doc["title"],
        destination_url=doc["destination_url"],
        redirect_url=doc["redirect_url"],
        redirect_count=doc.get("redirect_count", 0),
        is_active=doc.get("is_active", True),
        expires_at=doc.get("expires_at"),
        has_password=doc.get("has_password", False),
        created_at=doc.get("created_at", datetime.utcnow()),
        updated_at=doc.get("updated_at", datetime.utcnow()),
    )


# ── Dynamic QR CRUD ───────────────────────────────────────────────────────────

@router.post("/api/dynamic", response_model=DynamicQR)
async def create_dynamic_qr(
    data: DynamicQRCreate,
    current_user=Depends(get_current_user),
):
    """Create a dynamic QR code with a redirect URL that can be updated later."""
    dqr_id = str(uuid.uuid4())
    user_id = current_user["_id"]
    redirect_url = f"{settings.backend_base_url}/r/{dqr_id}"
    now = datetime.utcnow()

    # Hash password if provided
    hashed_password = hash_password(data.password) if data.password else None

    # Generate QR image pointing to redirect URL
    qr_style = QRStyle()
    qr_create = QRCreate(
        title=data.title,
        qr_type=QRType.DYNAMIC,
        content=redirect_url,
        style=qr_style,
    )
    png_bytes, b64 = generate_qr_image(qr_create)

    # Save QR image to disk
    from pathlib import Path
    img_dir = settings.qr_output_dir / user_id
    img_dir.mkdir(parents=True, exist_ok=True)
    img_path = img_dir / f"{dqr_id}.png"
    async with aiofiles.open(img_path, "wb") as f:
        await f.write(png_bytes)

    # Save QR code record
    qr_doc = {
        "_id":        dqr_id,
        "user_id":    user_id,
        "title":      data.title,
        "qr_type":    QRType.DYNAMIC,
        "content":    redirect_url,
        "style":      qr_style.model_dump(),
        "image_path": str(img_path),
        "image_b64":  b64,
        "scans":      0,
        "created_at": now,
        "updated_at": now,
    }
    db = get_db()
    await db.qrcodes.insert_one(qr_doc)

    # Save dynamic QR record (separate collection)
    dqr_doc = {
        "_id":              dqr_id,
        "user_id":          user_id,
        "title":            data.title,
        "destination_url":  data.destination_url,
        "redirect_url":     redirect_url,
        "redirect_count":   0,
        "is_active":        True,
        "expires_at":       data.expires_at,
        "has_password":     bool(hashed_password),
        "hashed_password":  hashed_password,
        "created_at":       now,
        "updated_at":       now,
    }
    await db.dynamic_qrs.insert_one(dqr_doc)

    return _doc_to_dynamic(dqr_doc)


@router.get("/api/dynamic", response_model=list[DynamicQR])
async def list_dynamic_qrs(current_user=Depends(get_current_user)):
    """List all dynamic QR codes for the authenticated user."""
    db = get_db()
    cursor = db.dynamic_qrs.find(
        {"user_id": current_user["_id"]}
    ).sort("created_at", -1)
    results = []
    async for doc in cursor:
        results.append(_doc_to_dynamic(doc))
    return results


@router.put("/api/dynamic/{dqr_id}", response_model=DynamicQR)
async def update_dynamic_qr(
    dqr_id: str,
    data: DynamicQRUpdate,
    current_user=Depends(get_current_user),
):
    """Update destination URL, expiry, or active state (auth required, must own)."""
    db = get_db()
    doc = await db.dynamic_qrs.find_one({"_id": dqr_id})
    if not doc:
        raise HTTPException(404, "Dynamic QR not found")
    if doc["user_id"] != current_user["_id"]:
        raise HTTPException(403, "Not authorized to edit this QR")

    updates: dict = {"updated_at": datetime.utcnow()}
    if data.destination_url is not None:
        updates["destination_url"] = data.destination_url
    if data.expires_at is not None:
        updates["expires_at"] = data.expires_at
    if data.is_active is not None:
        updates["is_active"] = data.is_active

    await db.dynamic_qrs.update_one({"_id": dqr_id}, {"$set": updates})
    doc.update(updates)
    return _doc_to_dynamic(doc)


@router.delete("/api/dynamic/{dqr_id}")
async def delete_dynamic_qr(
    dqr_id: str,
    current_user=Depends(get_current_user),
):
    """Delete a dynamic QR code (auth required, must own)."""
    db = get_db()
    doc = await db.dynamic_qrs.find_one({"_id": dqr_id})
    if not doc:
        raise HTTPException(404, "Dynamic QR not found")
    if doc["user_id"] != current_user["_id"]:
        raise HTTPException(403, "Not authorized to delete this QR")

    await db.dynamic_qrs.delete_one({"_id": dqr_id})
    await db.scans.delete_many({"dqr_id": dqr_id})
    # Also remove qrcodes record
    await db.qrcodes.delete_one({"_id": dqr_id})
    return {"deleted": True, "id": dqr_id}


# ── Public redirect ───────────────────────────────────────────────────────────

@router.get("/r/{dqr_id}")
async def redirect_dynamic_qr(request: Request, dqr_id: str, pw: str = Query(default="")):
    """
    Public redirect endpoint. Validates expiry and password, then redirects.
    Increments redirect_count on each successful redirect.
    """
    db = get_db()
    doc = await db.dynamic_qrs.find_one({"_id": dqr_id})

    if not doc or not doc.get("is_active", True):
        return HTMLResponse(
            content=_error_page("404 — QR Code Not Found",
                                "This QR code does not exist or has been deactivated."),
            status_code=404,
        )

    # Check expiry
    expires_at = doc.get("expires_at")
    if expires_at and datetime.utcnow() > expires_at:
        return HTMLResponse(
            content=_error_page("410 — QR Code Expired",
                                "This QR code has expired and is no longer active."),
            status_code=410,
        )

    # Check password
    if doc.get("has_password"):
        hashed = doc.get("hashed_password", "")
        if not pw or not verify_password(pw, hashed):
            return HTMLResponse(
                content=_error_page("401 — Password Required",
                                    "This QR code is password-protected. "
                                    "Add ?pw=YOUR_PASSWORD to the URL."),
                status_code=401,
            )

    # Increment redirect count and log the scan (logging must never break redirects)
    await db.dynamic_qrs.update_one(
        {"_id": dqr_id},
        {"$inc": {"redirect_count": 1}},
    )
    try:
        await db.scans.insert_one(_build_scan(request, dqr_id))
    except Exception:
        pass

    return RedirectResponse(doc["destination_url"], status_code=302)


# ── Scan logging & analytics ──────────────────────────────────────────────────

def _parse_ua(ua: str) -> tuple[str, str]:
    """Return (device, os) from a User-Agent string using simple heuristics."""
    u = ua.lower()
    if "android" in u:
        os_name = "Android"
    elif "iphone" in u or "ipad" in u or "ios" in u:
        os_name = "iOS"
    elif "windows" in u:
        os_name = "Windows"
    elif "mac os" in u or "macintosh" in u:
        os_name = "macOS"
    elif "linux" in u:
        os_name = "Linux"
    else:
        os_name = "Other"
    if "ipad" in u or "tablet" in u:
        device = "Tablet"
    elif "mobi" in u or os_name in ("Android", "iOS"):
        device = "Mobile"
    elif os_name == "Other":
        device = "Other"
    else:
        device = "Desktop"
    return device, os_name


def _build_scan(request: Request, dqr_id: str) -> dict:
    ua = request.headers.get("user-agent", "")
    device, os_name = _parse_ua(ua)
    fwd = request.headers.get("x-forwarded-for", "")
    ip = fwd.split(",")[0].strip() or (request.client.host if request.client else "")
    country = (
        request.headers.get("cf-ipcountry")
        or request.headers.get("x-vercel-ip-country")
        or request.headers.get("x-country")
        or "Unknown"
    )
    # Store only a salted hash of the IP (privacy) — enough to count unique visitors.
    visitor = hashlib.sha256(f"{settings.secret_key}:{ip}:{ua}".encode()).hexdigest()[:16]
    return {
        "dqr_id":    dqr_id,
        "ts":        datetime.utcnow(),
        "device":    device,
        "os":        os_name,
        "country":   country.upper() if len(country) == 2 else country,
        "referrer":  request.headers.get("referer", "") or "Direct",
        "visitor":   visitor,
    }


@router.get("/api/dynamic/{dqr_id}/analytics")
async def dynamic_qr_analytics(
    dqr_id: str,
    days: int = Query(default=30, ge=1, le=365),
    current_user=Depends(get_current_user),
):
    """Scan analytics for a dynamic QR: totals, unique visitors, daily series, breakdowns."""
    db = get_db()
    doc = await db.dynamic_qrs.find_one({"_id": dqr_id})
    if not doc:
        raise HTTPException(404, "Dynamic QR not found")
    if doc["user_id"] != current_user["_id"]:
        raise HTTPException(403, "Not authorized to view this QR")

    since = (datetime.utcnow() - timedelta(days=days - 1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    scans = [s async for s in db.scans.find({"dqr_id": dqr_id, "ts": {"$gte": since}})]

    daily = {(since + timedelta(days=i)).strftime("%Y-%m-%d"): 0 for i in range(days)}
    counters = {"device": {}, "os": {}, "country": {}, "referrer": {}}
    visitors = set()
    for s in scans:
        daily[s["ts"].strftime("%Y-%m-%d")] = daily.get(s["ts"].strftime("%Y-%m-%d"), 0) + 1
        visitors.add(s.get("visitor"))
        for k in counters:
            v = s.get(k) or "Unknown"
            counters[k][v] = counters[k].get(v, 0) + 1

    def top(d: dict, n: int = 8):
        return [{"name": k, "count": v}
                for k, v in sorted(d.items(), key=lambda x: -x[1])[:n]]

    return {
        "days":         days,
        "total_scans":  doc.get("redirect_count", 0),
        "period_scans": len(scans),
        "unique":       len(visitors),
        "daily":        [{"date": d, "count": c} for d, c in daily.items()],
        "devices":      top(counters["device"]),
        "os":           top(counters["os"]),
        "countries":    top(counters["country"]),
        "referrers":    top(counters["referrer"]),
    }


def _error_page(title: str, message: str) -> str:
    """Simple self-contained error HTML page."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0; background: #f9fafb; color: #111827;
    }}
    .card {{
      text-align: center; padding: 48px 32px; background: #fff;
      border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,.08); max-width: 400px;
    }}
    h1 {{ font-size: 1.5rem; margin-bottom: 12px; }}
    p {{ opacity: .6; line-height: 1.6; }}
    a {{ margin-top: 20px; display: inline-block; color: #1D59F9; text-decoration: none; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>{title}</h1>
    <p>{message}</p>
    <a href="/">← Back to QRify</a>
  </div>
</body>
</html>"""
