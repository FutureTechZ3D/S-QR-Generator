"""
Secure website logo/favicon fetcher.
All SSRF-prevention requirements implemented:
- Only http/https schemes
- Reject private/loopback IP ranges (before and after DNS resolution)
- 5s timeout, 500KB max response
- Only image content-types accepted
- SVG sanitization (strip script tags, event handlers, external refs)
- MongoDB cache with 24h TTL
- Returns base64-encoded PNG
"""
import re
import base64
import ipaddress
import socket
import io
import asyncio
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from PIL import Image

from ..core.database import get_db

# Allowed image content-type prefixes
ALLOWED_CONTENT_TYPES = {
    "image/png", "image/jpeg", "image/jpg", "image/gif",
    "image/x-icon", "image/vnd.microsoft.icon",
    "image/svg+xml", "image/webp",
}

MAX_RESPONSE_BYTES = 500 * 1024   # 500 KB
FETCH_TIMEOUT = 5.0               # seconds
CACHE_TTL_HOURS = 24


class SSRFError(Exception):
    """Raised when a URL/IP is considered unsafe for SSRF prevention."""


def _is_private_ip(ip_str: str) -> bool:
    """Return True if the IP is in a private, loopback, or link-local range."""
    try:
        addr = ipaddress.ip_address(ip_str)
        return (
            addr.is_private
            or addr.is_loopback
            or addr.is_link_local
            or addr.is_reserved
            or addr.is_multicast
            or addr.is_unspecified
        )
    except ValueError:
        return True  # unparseable — reject


def _validate_url(url: str) -> tuple[str, str]:
    """
    Validate URL scheme and return (cleaned_url, hostname).
    Raises SSRFError on invalid scheme or obviously bad URL.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise SSRFError(f"Only http/https URLs are allowed. Got scheme: {parsed.scheme!r}")
    hostname = parsed.hostname
    if not hostname:
        raise SSRFError("URL has no hostname")
    return url, hostname


def _resolve_and_validate_hostname(hostname: str) -> str:
    """
    Resolve hostname to IP. Raise SSRFError if IP is private/loopback.
    Returns the resolved IP string.
    """
    try:
        ip = socket.gethostbyname(hostname)
    except socket.gaierror as e:
        raise SSRFError(f"Cannot resolve hostname {hostname!r}: {e}")
    if _is_private_ip(ip):
        raise SSRFError(f"Hostname {hostname!r} resolves to private IP {ip} — blocked for security")
    return ip


def _sanitize_svg(svg_content: str) -> str:
    """
    Sanitize SVG content:
    - Strip <script> tags and their content
    - Remove on* event handler attributes
    - Remove xlink:href and href referencing external URLs from non-<a> elements
    - Remove <use> tags with external references
    """
    # Remove script tags
    svg_content = re.sub(r'<script[^>]*>.*?</script>', '', svg_content, flags=re.DOTALL | re.IGNORECASE)
    # Remove event handlers (on*=...)
    svg_content = re.sub(r'\s+on\w+=["\'][^\'"]*["\']', '', svg_content, flags=re.IGNORECASE)
    # Remove javascript: hrefs
    svg_content = re.sub(r'(href|xlink:href)=["\']javascript:[^\'"]*["\']', '', svg_content, flags=re.IGNORECASE)
    # Remove external xlink:href references (http/https/data) from use/image elements
    svg_content = re.sub(
        r'(<(?:use|image)[^>]*?)(?:xlink:href|href)=["\'](?:https?://)[^\'"]*["\']',
        r'\1',
        svg_content,
        flags=re.IGNORECASE | re.DOTALL,
    )
    return svg_content


def _to_png_b64(image_bytes: bytes, content_type: str) -> Optional[str]:
    """
    Convert image bytes to base64-encoded PNG string.
    SVG is left as base64-encoded SVG (PIL cannot rasterize SVG).
    Returns None on failure.
    """
    try:
        if "svg" in content_type:
            # Return as-is base64 SVG string
            return base64.b64encode(image_bytes).decode("utf-8")
        img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception:
        return None


async def _fetch_bytes(client: httpx.AsyncClient, url: str) -> tuple[bytes, str]:
    """
    Fetch bytes from URL. Returns (content_bytes, content_type).
    Raises on non-200, bad content-type, or oversized response.
    """
    resp = await client.get(url, timeout=FETCH_TIMEOUT, follow_redirects=True)
    resp.raise_for_status()
    content_type = resp.headers.get("content-type", "").split(";")[0].strip().lower()
    if len(resp.content) > MAX_RESPONSE_BYTES:
        raise ValueError(f"Response too large: {len(resp.content)} bytes")
    return resp.content, content_type


async def _try_favicon_ico(client: httpx.AsyncClient, base_url: str) -> Optional[tuple[bytes, str]]:
    """Try fetching /favicon.ico at the domain root."""
    try:
        parsed = urlparse(base_url)
        favicon_url = f"{parsed.scheme}://{parsed.netloc}/favicon.ico"
        data, ct = await _fetch_bytes(client, favicon_url)
        if ct in ALLOWED_CONTENT_TYPES or ct.startswith("image/"):
            return data, ct
    except Exception:
        pass
    return None


async def _try_html_icon(client: httpx.AsyncClient, base_url: str) -> Optional[tuple[bytes, str, str]]:
    """
    Fetch the HTML page and parse <link rel=icon/apple-touch-icon>.
    Returns (image_bytes, content_type, source_label) or None.
    """
    try:
        resp = await client.get(base_url, timeout=FETCH_TIMEOUT, follow_redirects=True)
        html_ct = resp.headers.get("content-type", "")
        if "html" not in html_ct:
            return None
        soup = BeautifulSoup(resp.text, "html.parser")
        # Prefer apple-touch-icon, then shortcut icon, then icon
        candidates = []
        for rel in ("apple-touch-icon", "shortcut icon", "icon"):
            tag = soup.find("link", rel=lambda r: r and rel in " ".join(r).lower() if r else False)
            if tag and tag.get("href"):
                candidates.append(tag["href"])
        parsed = urlparse(base_url)
        for href in candidates:
            icon_url = href if href.startswith("http") else f"{parsed.scheme}://{parsed.netloc}{href if href.startswith('/') else '/' + href}"
            try:
                data, ct = await _fetch_bytes(client, icon_url)
                if ct in ALLOWED_CONTENT_TYPES or ct.startswith("image/"):
                    return data, ct, "html_link_icon"
            except Exception:
                continue
    except Exception:
        pass
    return None


async def _try_og_image(client: httpx.AsyncClient, base_url: str) -> Optional[tuple[bytes, str]]:
    """
    Extract og:image as fallback (may not be a logo — caller should warn user).
    """
    try:
        resp = await client.get(base_url, timeout=FETCH_TIMEOUT, follow_redirects=True)
        soup = BeautifulSoup(resp.text, "html.parser")
        og_tag = soup.find("meta", property="og:image")
        if og_tag and og_tag.get("content"):
            og_url = og_tag["content"]
            data, ct = await _fetch_bytes(client, og_url)
            if ct in ALLOWED_CONTENT_TYPES or ct.startswith("image/"):
                return data, ct
    except Exception:
        pass
    return None


async def fetch_website_logo(url: str) -> dict:
    """
    Securely fetch favicon/logo from a website.
    Returns {favicon_b64, og_image_b64, source} or raises SSRFError / ValueError.
    """
    # Validate URL scheme
    url, hostname = _validate_url(url)

    # SSRF: resolve hostname and reject private IPs
    _resolve_and_validate_hostname(hostname)

    # Check MongoDB cache first
    db = get_db()
    cache_key = hostname.lower()
    cached = await db.logo_cache.find_one({"domain": cache_key})
    if cached:
        cache_age = datetime.utcnow() - cached.get("cached_at", datetime.utcnow())
        if cache_age < timedelta(hours=CACHE_TTL_HOURS):
            return {
                "favicon_b64": cached.get("favicon_b64"),
                "og_image_b64": cached.get("og_image_b64"),
                "source": cached.get("source", "cache"),
            }

    favicon_b64: Optional[str] = None
    og_image_b64: Optional[str] = None
    source = "none"

    async with httpx.AsyncClient(
        headers={"User-Agent": "QRify-Logo-Fetcher/1.0"},
        follow_redirects=True,
    ) as client:
        # Strategy 1: /favicon.ico
        result = await _try_favicon_ico(client, url)
        if result:
            data, ct = result
            if "svg" in ct:
                data = _sanitize_svg(data.decode("utf-8", errors="ignore")).encode("utf-8")
            favicon_b64 = _to_png_b64(data, ct)
            source = "favicon_ico"

        # Strategy 2: HTML link tags
        if not favicon_b64:
            html_result = await _try_html_icon(client, url)
            if html_result:
                data, ct, src = html_result
                if "svg" in ct:
                    data = _sanitize_svg(data.decode("utf-8", errors="ignore")).encode("utf-8")
                favicon_b64 = _to_png_b64(data, ct)
                source = src

        # Strategy 3: og:image fallback
        og_result = await _try_og_image(client, url)
        if og_result:
            data, ct = og_result
            if "svg" in ct:
                data = _sanitize_svg(data.decode("utf-8", errors="ignore")).encode("utf-8")
            og_image_b64 = _to_png_b64(data, ct)
            if not favicon_b64:
                source = "og_image"

    result_data = {
        "favicon_b64": favicon_b64,
        "og_image_b64": og_image_b64,
        "source": source,
    }

    # Cache in MongoDB
    await db.logo_cache.update_one(
        {"domain": cache_key},
        {"$set": {**result_data, "domain": cache_key, "cached_at": datetime.utcnow()}},
        upsert=True,
    )

    return result_data
