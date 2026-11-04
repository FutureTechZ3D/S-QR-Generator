"""
QR Code Generation Service
Uses the qrcode library to generate QR codes with custom styles.
Supports all qrfy.com content types: URL, WiFi, vCard, location, etc.
"""
import qrcode
import qrcode.image.svg
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import RoundedModuleDrawer, CircleModuleDrawer
import base64
import io
import re
from PIL import Image, ImageDraw
from typing import Optional
from ..models.qr import QRCreate, QRType, QRStyle


def build_qr_content(qr: QRCreate) -> str:
    """
    Convert structured content to the correct QR data string for each type.
    Each type has a standard encoding format that QR readers understand.
    """
    t = qr.qr_type
    c = qr.content

    if t == QRType.URL:
        # Ensure URL has protocol
        if not c.startswith(("http://", "https://")):
            c = "https://" + c
        return c

    elif t == QRType.EMAIL:
        # mailto:user@example.com?subject=Hello&body=World
        parts = c.split("|")  # email|subject|body
        email = parts[0].strip()
        subject = parts[1].strip() if len(parts) > 1 else ""
        body = parts[2].strip() if len(parts) > 2 else ""
        params = []
        if subject: params.append(f"subject={subject}")
        if body:    params.append(f"body={body}")
        suffix = "?" + "&".join(params) if params else ""
        return f"mailto:{email}{suffix}"

    elif t == QRType.PHONE:
        # tel:+1234567890
        digits = re.sub(r"[^\d+]", "", c)
        return f"tel:{digits}"

    elif t == QRType.SMS:
        # smsto:+1234567890:Message here
        parts = c.split("|", 1)  # phone|message
        phone = re.sub(r"[^\d+]", "", parts[0])
        msg = parts[1].strip() if len(parts) > 1 else ""
        return f"smsto:{phone}:{msg}"

    elif t == QRType.WIFI:
        # WIFI:T:WPA;S:NetworkName;P:password;;
        # content format: ssid|password|WPA|hidden(true/false)
        parts = c.split("|")
        ssid     = parts[0] if len(parts) > 0 else ""
        password = parts[1] if len(parts) > 1 else ""
        auth     = parts[2].upper() if len(parts) > 2 else "WPA"
        hidden   = "true" if len(parts) > 3 and parts[3].lower() == "true" else "false"
        return f"WIFI:T:{auth};S:{ssid};P:{password};H:{hidden};;"

    elif t == QRType.VCARD:
        # Standard vCard 3.0 format
        # content: name|phone|email|org|url|address
        parts = c.split("|")
        name    = parts[0] if len(parts) > 0 else ""
        phone   = parts[1] if len(parts) > 1 else ""
        email   = parts[2] if len(parts) > 2 else ""
        org     = parts[3] if len(parts) > 3 else ""
        url     = parts[4] if len(parts) > 4 else ""
        address = parts[5] if len(parts) > 5 else ""
        lines = [
            "BEGIN:VCARD", "VERSION:3.0",
            f"FN:{name}", f"N:{name}",
        ]
        if phone:   lines.append(f"TEL:{phone}")
        if email:   lines.append(f"EMAIL:{email}")
        if org:     lines.append(f"ORG:{org}")
        if url:     lines.append(f"URL:{url}")
        if address: lines.append(f"ADR:{address}")
        lines.append("END:VCARD")
        return "\n".join(lines)

    elif t == QRType.LOCATION:
        # geo:lat,lon
        parts = c.split("|", 1)
        lat = parts[0].strip()
        lon = parts[1].strip() if len(parts) > 1 else "0"
        return f"geo:{lat},{lon}"

    elif t == QRType.YOUTUBE:
        # Normalise YouTube URL
        vid_id = c
        if "youtube.com/watch?v=" in c:
            vid_id = c.split("v=")[1].split("&")[0]
        elif "youtu.be/" in c:
            vid_id = c.split("youtu.be/")[1].split("?")[0]
        return f"https://youtube.com/watch?v={vid_id}"

    else:
        # TEXT, PDF, IMAGE, APP_STORE, MENU — use content directly or as URL
        return c


def generate_qr_image(qr_create: QRCreate) -> tuple[bytes, str]:
    """
    Generate a QR code PNG image.
    Returns (png_bytes, base64_string).
    """
    content = build_qr_content(qr_create)
    style   = qr_create.style

    # Error correction level
    ec_map = {
        "L": qrcode.constants.ERROR_CORRECT_L,
        "M": qrcode.constants.ERROR_CORRECT_M,
        "Q": qrcode.constants.ERROR_CORRECT_Q,
        "H": qrcode.constants.ERROR_CORRECT_H,
    }
    ec = ec_map.get(style.error_correct, qrcode.constants.ERROR_CORRECT_H)

    # Build QR
    qr = qrcode.QRCode(
        version=None,
        error_correction=ec,
        box_size=style.box_size,
        border=style.border,
    )
    qr.add_data(content)
    qr.make(fit=True)

    # Parse hex colors
    def hex_to_rgb(hex_color: str) -> tuple:
        h = hex_color.lstrip("#")
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

    fg_rgb = hex_to_rgb(style.foreground)
    bg_rgb = hex_to_rgb(style.background)

    img = qr.make_image(
        fill_color=fg_rgb,
        back_color=bg_rgb,
    )

    # Add logo if provided
    if style.logo_url:
        try:
            import httpx
            resp = httpx.get(style.logo_url, timeout=5.0)
            if resp.status_code == 200:
                logo = Image.open(io.BytesIO(resp.content)).convert("RGBA")
                img_pil = img.get_image() if hasattr(img, "get_image") else img
                # Logo takes up max 25% of QR
                qr_w, qr_h = img_pil.size
                max_logo = int(min(qr_w, qr_h) * 0.25)
                logo.thumbnail((max_logo, max_logo), Image.LANCZOS)
                pos = ((qr_w - logo.width) // 2, (qr_h - logo.height) // 2)
                img_pil.paste(logo, pos, logo)
                img = img_pil
        except Exception:
            pass

    # Export to bytes
    buf = io.BytesIO()
    if hasattr(img, "save"):
        img.save(buf, format="PNG")
    else:
        img.get_image().save(buf, format="PNG")

    png_bytes = buf.getvalue()
    b64 = base64.b64encode(png_bytes).decode("utf-8")
    return png_bytes, b64


def generate_qr_svg(qr_create: QRCreate) -> str:
    """Generate an SVG QR code (scalable, perfect for print)."""
    content = build_qr_content(qr_create)

    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_H,
    )
    qr.add_data(content)
    qr.make(fit=True)

    factory = qrcode.image.svg.SvgPathImage
    img = qr.make_image(image_factory=factory)

    buf = io.BytesIO()
    img.save(buf)
    return buf.getvalue().decode("utf-8")
