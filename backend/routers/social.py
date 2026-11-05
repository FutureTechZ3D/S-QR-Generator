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
from ..core.database import get_db
from ..core.security import get_current_user, get_optional_user
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
    """Return perceived luminance (0=dark, 1=bright) for a hex color."""
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))
    return 0.299 * r + 0.587 * g + 0.114 * b


@router.get("/p/{slug}", response_class=HTMLResponse)
async def profile_landing_page(slug: str):
    """
    Public profile landing page. Returns mobile-first self-contained HTML.
    No external CDN dependencies — all CSS is inline.
    """
    db = get_db()
    doc = await db.social_profiles.find_one({"slug": slug})
    if not doc:
        return HTMLResponse(
            content="<html><body><h1>Profile not found</h1></body></html>",
            status_code=404,
        )

    profile = _doc_to_profile(doc)
    profile_id = doc["_id"]

    # Decide text color based on background luminance
    text_color = "#1a1a1a" if _luminance(profile.bg_color) > 0.5 else "#f5f5f5"
    theme = profile.theme_color

    # Build initials fallback for avatar
    initials = "".join(w[0].upper() for w in profile.name.split()[:2]) or "?"

    # Avatar section
    if profile.avatar_url:
        avatar_html = (
            f'<img src="{profile.avatar_url}" alt="{profile.name}" '
            f'class="avatar" onerror="this.style.display=\'none\'; '
            f'document.getElementById(\'avatar-init\').style.display=\'flex\';" />'
            f'<div id="avatar-init" class="avatar avatar-init" style="display:none">'
            f'{initials}</div>'
        )
    else:
        avatar_html = (
            f'<div class="avatar avatar-init">{initials}</div>'
        )

    # Build link buttons
    link_buttons = ""
    for lnk in profile.links:
        plat = get_platform(lnk.platform_id)
        if plat:
            btn_color = plat["color"]
            btn_label = lnk.title or plat["name"]
            icon = plat["icon_emoji"]
            # Use white text for dark backgrounds, dark for light
            btn_text = "#ffffff" if _luminance(btn_color) < 0.5 else "#1a1a1a"
            link_buttons += (
                f'<a href="{lnk.url}" class="link-btn" target="_blank" rel="noopener" '
                f'style="background:{btn_color};color:{btn_text};" '
                f'onclick="trackClick(\'{lnk.platform_id}\')">'
                f'<span class="link-icon">{icon}</span>'
                f'<span class="link-label">{btn_label}</span>'
                f'</a>\n'
            )
        else:
            btn_label = lnk.title or lnk.url
            link_buttons += (
                f'<a href="{lnk.url}" class="link-btn" target="_blank" rel="noopener" '
                f'style="background:{theme};color:#ffffff;">'
                f'<span class="link-icon">🔗</span>'
                f'<span class="link-label">{btn_label}</span>'
                f'</a>\n'
            )

    bio_section = f'<p class="bio">{profile.bio}</p>' if profile.bio else ""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{profile.name} — QRify Profile</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: {profile.bg_color};
      color: {text_color};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      padding: 24px 16px 48px;
    }}
    .profile {{
      max-width: 480px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }}
    .avatar {{
      width: 80px;
      height: 80px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid {theme};
    }}
    .avatar-init {{
      display: flex;
      align-items: center;
      justify-content: center;
      background: {theme};
      color: #ffffff;
      font-size: 1.6rem;
      font-weight: 700;
    }}
    h1 {{
      font-size: 1.5rem;
      font-weight: 700;
      text-align: center;
    }}
    .username {{
      font-size: 0.95rem;
      opacity: 0.7;
      text-align: center;
    }}
    .bio {{
      font-size: 0.9rem;
      text-align: center;
      opacity: 0.8;
      max-width: 380px;
      line-height: 1.5;
    }}
    .links {{
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 8px;
    }}
    .link-btn {{
      width: 100%;
      padding: 16px 20px;
      border-radius: 12px;
      font-size: 1.05rem;
      font-weight: 600;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: opacity 0.15s, transform 0.1s;
    }}
    .link-btn:hover {{ opacity: 0.88; transform: translateY(-1px); }}
    .link-btn:active {{ transform: translateY(0); }}
    .link-icon {{ font-size: 1.3rem; flex-shrink: 0; }}
    .link-label {{ flex: 1; }}
    .footer {{
      margin-top: 40px;
      font-size: 0.75rem;
      opacity: 0.45;
      text-align: center;
    }}
    .footer a {{ color: inherit; text-decoration: none; }}
  </style>
</head>
<body>
  <div class="profile">
    {avatar_html}
    <h1>{profile.name}</h1>
    <p class="username">@{profile.username}</p>
    {bio_section}
    <div class="links">
      {link_buttons}
    </div>
    <p class="footer">Powered by <a href="https://qrify.app" target="_blank" rel="noopener">QRify</a></p>
  </div>
  <script>
    // Track profile visit
    fetch('/api/profile/{profile_id}/track', {{ method: 'POST' }}).catch(() => {{}});

    function trackClick(platformId) {{
      // Future: POST /api/profile/{profile_id}/click with platform info
    }}
  </script>
</body>
</html>"""

    return HTMLResponse(content=html, status_code=200)
