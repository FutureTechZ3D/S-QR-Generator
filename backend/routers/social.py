# backend/routers/social.py
"""
Social QR and Social Profile routes.

GET  /api/platforms                  → list all platforms (no auth)
POST /api/qr/social                  → generate social QR (optional auth for save)
POST /api/profile                    → create social profile (auth required)
GET  /api/profiles                   → list user's profiles (auth required)
GET  /api/profile/{profile_id}       → get profile (no auth — needed for public page)
PUT  /api/profile/{profile_id}       → update profile (auth required, must own)
DELETE /api/profile/{profile_id}     → delete profile (auth required, must own)
POST /api/profile/{profile_id}/track → increment visit count (no auth)
GET  /p/{slug}                       → public profile landing page (no auth)
"""
import html
import uuid
import re
import aiofiles
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import HTMLResponse
from ..models.qr import QRCreate, QRType, QRStyle
from ..models.social_profile import (
    SocialLink,
    SocialProfile,
    SocialProfileCreate,
    SocialProfileUpdate,
)
from ..services.qr_service import generate_qr_image
from ..services.platform_registry import (
    list_platforms,
    get_platform,
    build_platform_url,
)
from ..services.platform_detector import detect_platform
from ..services.logo_fetcher import fetch_website_logo, SSRFError
from ..core.database import get_db
from ..core.security import get_current_user, get_optional_user, require_pro
from ..core.config import settings

router = APIRouter(tags=["social"])


# ── Helper ────────────────────────────────────────────────────────────────────

def _generate_slug(name: str) -> str:
    """Generate a URL-safe unique slug from a profile name."""
    safe = re.sub(r"[^a-z0-9-]", "", name.lower().replace(" ", "-"))[:30]
    return safe + "-" + uuid.uuid4().hex[:6]


def _doc_to_profile(doc: dict) -> SocialProfile:
    links = [SocialLink(**lnk) for lnk in doc.get("links", [])]
    return SocialProfile(
        id=doc["_id"],
        user_id=doc["user_id"],
        name=doc["name"],
        username=doc["username"],
        bio=doc.get("bio"),
        avatar_url=doc.get("avatar_url"),
        theme_color=doc.get("theme_color", "#1D59F9"),
        bg_color=doc.get("bg_color", "#FFFFFF"),
        links=links,
        visits=doc.get("visits", 0),
        slug=doc["slug"],
        created_at=doc.get("created_at", datetime.utcnow()),
        updated_at=doc.get("updated_at", datetime.utcnow()),
    )


# ── Platform registry ─────────────────────────────────────────────────────────

@router.get("/api/platforms")
async def get_platforms():
    """Return all registered social platforms."""
    return list_platforms()


# ── Platform detection ───────────────────────────────────────────────────────

@router.post("/api/detect-platform")
async def detect_platform_endpoint(url: str = Body(..., embed=True)):
    """
    Detect platform from a URL.
    Returns the platform dict with suggested_theme, or {"platform": null} if no match.
    """
    result = detect_platform(url)
    return {"platform": result}


# ── Logo fetch (PRO) ─────────────────────────────────────────────────────────

@router.post("/api/logo/fetch")
async def fetch_logo(
    url: str = Body(..., embed=True),
    current_user=Depends(require_pro),
):
    """
    Fetch website favicon/logo. PRO users only.
    Returns {favicon_b64, og_image_b64, source}.
    """
    try:
        result = await fetch_website_logo(url)
        return result
    except SSRFError as e:
        raise HTTPException(status_code=400, detail=f"Security: {e}")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not fetch logo: {e}")


# ── Social QR generation ──────────────────────────────────────────────────────

@router.post("/api/qr/social")
async def generate_social_qr(
    platform_id: str = Body(...),
    username_or_url: str = Body(...),
    title: str = Body(...),
    style: dict = Body(default_factory=dict),
    save: bool = Body(False),
    current_user=Depends(get_optional_user),
):
    """
    Generate a QR code for a specific social platform.
    Builds the platform URL, generates the QR image, optionally saves to account.
    """
    platform = get_platform(platform_id)
    if not platform:
        raise HTTPException(400, f"Unknown platform: {platform_id}")

    platform_url = build_platform_url(platform_id, username_or_url)
    if not platform_url:
        raise HTTPException(400, "Could not build platform URL")

    qr_style = QRStyle(**{k: v for k, v in style.items() if k in QRStyle.model_fields})
    qr_create = QRCreate(
        title=title,
        qr_type=QRType.SOCIAL,
        content=platform_url,
        style=qr_style,
    )

    png_bytes, b64 = generate_qr_image(qr_create)

    # Optionally save to account if authenticated
    if save and current_user:
        import uuid as _uuid
        from pathlib import Path
        qr_id = str(_uuid.uuid4())
        user_id = current_user["_id"]
        img_dir = settings.qr_output_dir / user_id
        img_dir.mkdir(parents=True, exist_ok=True)
        img_path = img_dir / f"{qr_id}.png"
        async with aiofiles.open(img_path, "wb") as f:
            await f.write(png_bytes)
        doc = {
            "_id":        qr_id,
            "user_id":    user_id,
            "title":      title,
            "qr_type":    QRType.SOCIAL,
            "content":    platform_url,
            "style":      qr_style.model_dump(),
            "image_path": str(img_path),
            "image_b64":  b64,
            "scans":      0,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        db = get_db()
        await db.qrcodes.insert_one(doc)

    return {
        "image_b64":    b64,
        "platform_url": platform_url,
        "platform":     platform,
    }


# ── Social Profile CRUD ───────────────────────────────────────────────────────

@router.post("/api/profile", response_model=SocialProfile)
async def create_profile(
    data: SocialProfileCreate,
    current_user=Depends(get_current_user),
):
    """Create a new social profile (All-in-One Social Profile QR)."""
    slug = _generate_slug(data.name)
    profile_id = str(uuid.uuid4())
    now = datetime.utcnow()
    doc = {
        "_id":        profile_id,
        "user_id":    current_user["_id"],
        "name":       data.name,
        "username":   data.username,
        "bio":        data.bio,
        "avatar_url": data.avatar_url,
        "theme_color": data.theme_color,
        "bg_color":   data.bg_color,
        "links":      [lnk.model_dump() for lnk in data.links],
        "visits":     0,
        "slug":       slug,
        "created_at": now,
        "updated_at": now,
    }
    db = get_db()
    await db.social_profiles.insert_one(doc)
    return _doc_to_profile(doc)


@router.get("/api/profiles", response_model=list[SocialProfile])
async def list_profiles(current_user=Depends(get_current_user)):
    """List all social profiles for the authenticated user."""
    db = get_db()
    cursor = db.social_profiles.find(
        {"user_id": current_user["_id"]}
    ).sort("created_at", -1)
    profiles = []
    async for doc in cursor:
        profiles.append(_doc_to_profile(doc))
    return profiles


@router.get("/api/profile/{profile_id}", response_model=SocialProfile)
async def get_profile(profile_id: str):
    """Get a social profile by ID (public, no auth required)."""
    db = get_db()
    doc = await db.social_profiles.find_one({"_id": profile_id})
    if not doc:
        raise HTTPException(404, "Profile not found")
    return _doc_to_profile(doc)


@router.put("/api/profile/{profile_id}", response_model=SocialProfile)
async def update_profile(
    profile_id: str,
    data: SocialProfileUpdate,
    current_user=Depends(get_current_user),
):
    """Update a social profile (auth required, must own)."""
    db = get_db()
    doc = await db.social_profiles.find_one({"_id": profile_id})
    if not doc:
        raise HTTPException(404, "Profile not found")
    if doc["user_id"] != current_user["_id"]:
        raise HTTPException(403, "Not authorized to edit this profile")

    updates: dict = {"updated_at": datetime.utcnow()}
    for field in ("name", "username", "bio", "avatar_url", "theme_color", "bg_color"):
        val = getattr(data, field)
        if val is not None:
            updates[field] = val
    if data.links is not None:
        updates["links"] = [lnk.model_dump() for lnk in data.links]

    await db.social_profiles.update_one({"_id": profile_id}, {"$set": updates})
    doc.update(updates)
    return _doc_to_profile(doc)


@router.delete("/api/profile/{profile_id}")
async def delete_profile(
    profile_id: str,
    current_user=Depends(get_current_user),
):
    """Delete a social profile (auth required, must own)."""
    db = get_db()
    doc = await db.social_profiles.find_one({"_id": profile_id})
    if not doc:
        raise HTTPException(404, "Profile not found")
    if doc["user_id"] != current_user["_id"]:
        raise HTTPException(403, "Not authorized to delete this profile")
    await db.social_profiles.delete_one({"_id": profile_id})
    return {"deleted": True, "id": profile_id}


@router.post("/api/profile/{profile_id}/track")
async def track_profile_visit(profile_id: str):
    """Increment visit count (no auth — called from landing page JS)."""
    db = get_db()
    result = await db.social_profiles.update_one(
        {"_id": profile_id},
        {"$inc": {"visits": 1}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Profile not found")
    doc = await db.social_profiles.find_one({"_id": profile_id}, {"visits": 1})
    return {"visits": doc.get("visits", 0) if doc else 0}


# ── Public Profile Landing Page (FEAT-002) ────────────────────────────────────

def _luminance(hex_color: str) -> float:
    """Return perceived luminance (0=dark, 1=bright) for a hex color string."""
    h = hex_color.lstrip("#")
    if len(h) != 6:
        return 1.0  # default to bright if malformed
    r, g, b = (int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))
    return 0.299 * r + 0.587 * g + 0.114 * b


def _build_404_html() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Profile Not Found | QRify</title>
  <style>
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
           background:#f5f5f5; display:flex; align-items:center; justify-content:center;
           min-height:100vh; color:#1a1a1a; }
    .box { text-align:center; padding:40px 24px; }
    h1 { font-size:2rem; margin:0 0 12px; }
    p  { opacity:.6; margin:0 0 24px; }
    a  { color:#1D59F9; text-decoration:none; font-weight:600; }
  </style>
</head>
<body>
  <div class="box">
    <h1>🔍 Profile not found</h1>
    <p>This QRify profile link does not exist or has been removed.</p>
    <a href="http://localhost:5174">Create your own profile →</a>
  </div>
</body>
</html>"""


@router.get("/p/{slug}", response_class=HTMLResponse)
async def profile_landing_page(slug: str):
    """
    Public profile landing page. Returns mobile-first self-contained HTML.
    No external CDN dependencies — all CSS is inline.
    All user-provided content is HTML-escaped via html.escape().
    """
    db = get_db()
    doc = await db.social_profiles.find_one({"slug": slug})
    if not doc:
        # Acceptance criteria: return 200 with a "not found" HTML, not a 500 or hard 404
        return HTMLResponse(content=_build_404_html(), status_code=200)

    profile = _doc_to_profile(doc)
    profile_id = doc["_id"]

    # ── Colour & text helpers ─────────────────────────────────────────────────
    bg_lum = _luminance(profile.bg_color)
    # text_color: primary
    text_color   = "#1a1a1a" if bg_lum >= 0.4 else "#FFFFFF"
    # text_color_2: muted secondary
    text_color_2 = "#555555" if bg_lum >= 0.4 else "#cccccc"
    # text_color_3: very subtle (powered-by footer)
    text_color_3 = "#aaaaaa" if bg_lum >= 0.4 else "#888888"

    theme_color = profile.theme_color

    # ── Avatar ────────────────────────────────────────────────────────────────
    safe_name = html.escape(profile.name)
    initials   = "".join(w[0].upper() for w in profile.name.split() if w)[:2] or "?"

    if profile.avatar_url:
        safe_avatar_url = html.escape(profile.avatar_url)
        avatar_tag = (
            f'<img src="{safe_avatar_url}" alt="{safe_name}" class="avatar" />'
        )
    else:
        avatar_tag = (
            f'<div class="avatar-initials">{html.escape(initials)}</div>'
        )

    # ── Bio ───────────────────────────────────────────────────────────────────
    bio_tag = (
        f'<p class="bio">{html.escape(profile.bio)}</p>'
        if profile.bio
        else ""
    )

    # ── Link buttons ──────────────────────────────────────────────────────────
    links_html = ""
    for lnk in profile.links:
        plat = get_platform(lnk.platform_id)
        if plat:
            color      = plat["color"]
            icon_emoji = plat["icon_emoji"]
            plat_name  = plat["name"]
        else:
            color      = "#6B7280"
            icon_emoji = "🔗"
            plat_name  = lnk.platform_id

        btn_label = html.escape(lnk.title or plat_name)
        safe_url  = html.escape(lnk.url)
        links_html += (
            f'<a href="{safe_url}" class="link-btn" '
            f'style="background:{color};" '
            f'target="_blank" rel="noopener">'
            f'<span class="icon">{icon_emoji}</span>'
            f'<span>{btn_label}</span>'
            f'</a>\n'
        )

    safe_username = html.escape(profile.username)

    # ── Full HTML ─────────────────────────────────────────────────────────────
    html_str = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{safe_name} | QRify Profile</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: {profile.bg_color};
      min-height: 100vh;
      display: flex;
      justify-content: center;
    }}
    .profile {{
      max-width: 480px;
      width: 100%;
      padding: 32px 20px 60px;
    }}
    .avatar {{
      width: 80px;
      height: 80px;
      border-radius: 50%;
      object-fit: cover;
      margin: 0 auto 16px;
      display: block;
      border: 3px solid {theme_color};
    }}
    .avatar-initials {{
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: {theme_color};
      color: #fff;
      font-size: 2rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }}
    h1 {{
      text-align: center;
      font-size: 1.5rem;
      font-weight: 700;
      margin: 0 0 4px;
      color: {text_color};
    }}
    .username {{
      text-align: center;
      color: {text_color_2};
      margin: 0 0 12px;
      font-size: 0.9rem;
    }}
    .bio {{
      text-align: center;
      color: {text_color_2};
      margin: 0 0 28px;
      font-size: 0.95rem;
      line-height: 1.5;
    }}
    .links {{
      display: flex;
      flex-direction: column;
      gap: 12px;
    }}
    .link-btn {{
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 20px;
      border-radius: 14px;
      text-decoration: none;
      font-size: 1rem;
      font-weight: 600;
      color: #fff;
      transition: opacity 0.15s;
    }}
    .link-btn:hover {{ opacity: 0.88; }}
    .link-btn .icon {{ font-size: 1.4rem; flex-shrink: 0; }}
    .powered {{
      text-align: center;
      margin-top: 32px;
      font-size: 0.75rem;
      color: {text_color_3};
    }}
    .powered a {{ color: {theme_color}; text-decoration: none; }}
  </style>
</head>
<body>
  <div class="profile">
    {avatar_tag}
    <h1>{safe_name}</h1>
    <p class="username">@{safe_username}</p>
    {bio_tag}
    <div class="links">
      {links_html}
    </div>
    <p class="powered">Powered by <a href="http://localhost:5174">QRify</a></p>
  </div>
  <script>
    try {{
      fetch('/api/profile/{profile_id}/track', {{ method: 'POST' }});
    }} catch(e) {{}}
  </script>
</body>
</html>"""

    return HTMLResponse(content=html_str, status_code=200)
